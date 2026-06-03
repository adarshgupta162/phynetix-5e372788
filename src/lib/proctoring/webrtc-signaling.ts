// Supabase Realtime WebRTC signaling for live monitoring.
// Student = publisher (offerer per viewer). Admin = subscriber (answerer).
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const channelName = (sessionId: string) => `monitor-rtc-${sessionId}`;

export type PublisherHandle = {
  close: () => void;
  channel: RealtimeChannel;
  peers: Map<string, RTCPeerConnection>;
};

/**
 * Student-side: listens for viewer-join requests and creates a peer connection per admin.
 */
export function startPublisher(opts: {
  sessionId: string;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
}): PublisherHandle {
  const peers = new Map<string, RTCPeerConnection>();
  const channel = supabase.channel(channelName(opts.sessionId), {
    config: { broadcast: { ack: false, self: false } },
  });

  const sendTo = (viewerId: string, type: string, payload: any) =>
    channel.send({ type: "broadcast", event: type, payload: { ...payload, viewerId } });

  const createPeerFor = async (viewerId: string) => {
    // Tear down existing for that viewer
    peers.get(viewerId)?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });
    peers.set(viewerId, pc);

    if (opts.cameraStream) {
      for (const track of opts.cameraStream.getTracks()) {
        pc.addTrack(track, opts.cameraStream);
      }
    }
    if (opts.screenStream) {
      for (const track of opts.screenStream.getTracks()) {
        pc.addTrack(track, opts.screenStream);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) void sendTo(viewerId, "publisher-ice", { candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        // Keep the peer; let admin re-request if needed.
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendTo(viewerId, "publisher-offer", { sdp: pc.localDescription });
  };

  channel
    .on("broadcast", { event: "viewer-join" }, async (msg) => {
      const viewerId = msg.payload?.viewerId;
      if (!viewerId) return;
      try { await createPeerFor(viewerId); } catch (e) { console.error("createPeerFor failed", e); }
    })
    .on("broadcast", { event: "viewer-answer" }, async (msg) => {
      const { viewerId, sdp } = msg.payload || {};
      const pc = peers.get(viewerId);
      if (!pc || !sdp) return;
      try { await pc.setRemoteDescription(sdp); } catch (e) { console.error("setRemoteDescription answer failed", e); }
    })
    .on("broadcast", { event: "viewer-ice" }, async (msg) => {
      const { viewerId, candidate } = msg.payload || {};
      const pc = peers.get(viewerId);
      if (!pc || !candidate) return;
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn("addIceCandidate (viewer->pub) failed", e); }
    })
    .on("broadcast", { event: "viewer-leave" }, (msg) => {
      const viewerId = msg.payload?.viewerId;
      if (!viewerId) return;
      peers.get(viewerId)?.close();
      peers.delete(viewerId);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Announce presence so any waiting viewer can re-join.
        await channel.send({ type: "broadcast", event: "publisher-ready", payload: {} });
      }
    });

  return {
    channel,
    peers,
    close: () => {
      peers.forEach((pc) => { try { pc.close(); } catch { /* ignore */ } });
      peers.clear();
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

export type SubscriberHandle = {
  close: () => void;
  stream: MediaStream;
  channel: RealtimeChannel;
  pc: RTCPeerConnection;
};

/**
 * Admin-side: requests a stream from a student and renders the resulting tracks.
 */
export function startSubscriber(opts: {
  sessionId: string;
  onStatus?: (s: "connecting" | "waiting" | "live" | "error", err?: string) => void;
  onTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
}): SubscriberHandle {
  const viewerId = `viewer-${crypto.randomUUID().slice(0, 8)}`;
  const stream = new MediaStream();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });

  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => { if (!stream.getTracks().includes(t)) stream.addTrack(t); });
    if (!e.streams.length) { try { stream.addTrack(e.track); } catch { /* ignore */ } }
    opts.onTrack?.(e.track, stream);
    opts.onStatus?.("live");
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") opts.onStatus?.("error", "WebRTC connection failed");
  };

  const channel = supabase.channel(channelName(opts.sessionId), {
    config: { broadcast: { ack: false, self: false } },
  });

  const sendBroadcast = (event: string, payload: any) =>
    channel.send({ type: "broadcast", event, payload: { ...payload, viewerId } });

  pc.onicecandidate = (e) => {
    if (e.candidate) void sendBroadcast("viewer-ice", { candidate: e.candidate.toJSON() });
  };

  channel
    .on("broadcast", { event: "publisher-offer" }, async (msg) => {
      if (msg.payload?.viewerId !== viewerId) return;
      const sdp = msg.payload?.sdp;
      if (!sdp) return;
      try {
        await pc.setRemoteDescription(sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendBroadcast("viewer-answer", { sdp: pc.localDescription });
        opts.onStatus?.("connecting");
      } catch (e: any) {
        console.error("subscriber answer failed", e);
        opts.onStatus?.("error", e?.message || String(e));
      }
    })
    .on("broadcast", { event: "publisher-ice" }, async (msg) => {
      if (msg.payload?.viewerId !== viewerId) return;
      const candidate = msg.payload?.candidate;
      if (!candidate) return;
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn("addIceCandidate (pub->view) failed", e); }
    })
    .on("broadcast", { event: "publisher-ready" }, async () => {
      // Publisher (re)appeared — re-join.
      await sendBroadcast("viewer-join", {});
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        opts.onStatus?.("waiting");
        await sendBroadcast("viewer-join", {});
      }
    });

  return {
    channel,
    pc,
    stream,
    close: () => {
      try { void sendBroadcast("viewer-leave", {}); } catch { /* ignore */ }
      try { pc.close(); } catch { /* ignore */ }
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}
