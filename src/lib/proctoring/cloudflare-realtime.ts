// Cloudflare Realtime (Calls) client helpers.
// Two roles: publisher (student) sends camera+screen tracks; subscriber (admin) pulls them.
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
];

async function invoke(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("cf-realtime", {
    body: { action, ...body },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export type PublishHandle = {
  cfSessionId: string;
  pc: RTCPeerConnection;
  cameraTrackName?: string;
  microphoneTrackName?: string;
  screenTrackName?: string;
  close: () => void;
};

export async function publishStreams(opts: {
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
}): Promise<PublishHandle> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });

  const { sessionId } = await invoke("new-session");
  if (!sessionId) throw new Error("CF new-session returned no sessionId");

  const transceiverMap: Array<{ kind: "camera" | "microphone" | "screen"; transceiver: RTCRtpTransceiver }> = [];

  if (opts.cameraStream) {
    for (const track of opts.cameraStream.getVideoTracks()) {
      const tx = pc.addTransceiver(track, { direction: "sendonly" });
      transceiverMap.push({ kind: "camera", transceiver: tx });
    }
    for (const track of opts.cameraStream.getAudioTracks()) {
      const tx = pc.addTransceiver(track, { direction: "sendonly" });
      transceiverMap.push({ kind: "microphone", transceiver: tx });
    }
  }
  if (opts.screenStream) {
    for (const track of opts.screenStream.getVideoTracks()) {
      const tx = pc.addTransceiver(track, { direction: "sendonly" });
      transceiverMap.push({ kind: "screen", transceiver: tx });
    }
  }

  if (!transceiverMap.length) {
    pc.close();
    throw new Error("No tracks to publish");
  }

  // Build the desired tracks list (we choose trackNames; CF will confirm them).
  const tracks = transceiverMap.map((entry, idx) => ({
    mid: entry.transceiver.mid ?? `${idx}`,
    trackName: `${entry.kind}-${idx}`,
    kind: entry.kind,
  }));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // Wait for ICE gathering to complete (simpler than trickle for first offer)
  await waitForIce(pc);

  // Re-collect mids after local description set
  const finalTracks = transceiverMap.map((entry, idx) => ({
    mid: entry.transceiver.mid ?? `${idx}`,
    trackName: `${entry.kind}-${idx}`,
    kind: entry.kind,
  }));

  const resp = await invoke("tracks-publish", {
    sessionId,
    sdp: pc.localDescription?.sdp,
    tracks: finalTracks,
  });

  if (!resp?.sessionDescription?.sdp) throw new Error("CF publish: no answer SDP");
  await pc.setRemoteDescription({ type: "answer", sdp: resp.sessionDescription.sdp });

  // Map CF-confirmed trackNames back by mid
  const cfTracks: Array<{ mid: string; trackName: string }> = resp.tracks || [];
  const result: PublishHandle = {
    cfSessionId: sessionId,
    pc,
    close: () => { try { pc.close(); } catch { /* ignore */ } },
  };
  for (const entry of transceiverMap) {
    const cf = cfTracks.find((t) => t.mid === entry.transceiver.mid);
    const name = cf?.trackName ?? finalTracks.find((t) => t.mid === entry.transceiver.mid)?.trackName;
    if (!name) continue;
    if (entry.kind === "camera") result.cameraTrackName = name;
    else if (entry.kind === "microphone") result.microphoneTrackName = name;
    else if (entry.kind === "screen") result.screenTrackName = name;
  }
  return result;
}

export type PullHandle = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  close: () => void;
};

export async function pullStreams(opts: {
  publisherCfSessionId: string;
  trackNames: string[];
}): Promise<PullHandle> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });
  const remoteStream = new MediaStream();

  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
    if (!e.streams.length) remoteStream.addTrack(e.track);
  };

  // Create the subscriber session
  const { sessionId: subSessionId } = await invoke("new-session");

  // Ask CF to set up remote tracks; CF responds with an offer SDP
  const pullResp = await invoke("tracks-pull", {
    sessionId: subSessionId,
    tracks: opts.trackNames.map((trackName) => ({
      sessionId: opts.publisherCfSessionId,
      trackName,
    })),
  });

  if (pullResp?.sessionDescription?.sdp) {
    await pc.setRemoteDescription({
      type: pullResp.sessionDescription.type || "offer",
      sdp: pullResp.sessionDescription.sdp,
    });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIce(pc);
    await invoke("renegotiate", {
      sessionId: subSessionId,
      sdp: pc.localDescription?.sdp,
      type: "answer",
    });
  }

  return {
    pc,
    stream: remoteStream,
    close: () => { try { pc.close(); } catch { /* ignore */ } },
  };
}

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    // Safety timeout
    setTimeout(() => resolve(), 3000);
  });
}
