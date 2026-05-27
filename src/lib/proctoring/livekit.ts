// LiveKit client helpers: publisher (student) and subscriber (admin).
import {
  Room,
  RoomEvent,
  Track,
  LocalTrack,
  RemoteTrack,
  RemoteParticipant,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

async function getToken(opts: { role: "publisher" | "subscriber"; room?: string; identity?: string; name?: string }) {
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: opts });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { token: string; url: string; room: string; identity: string };
}

export type PublishHandle = {
  room: Room;
  roomName: string;
  identity: string;
  hasCamera: boolean;
  hasScreen: boolean;
  close: () => void;
};

export async function publishStreams(opts: {
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  roomName?: string;
}): Promise<PublishHandle> {
  const hasCamera = !!(opts.cameraStream && opts.cameraStream.getTracks().length);
  const hasScreen = !!(opts.screenStream && opts.screenStream.getTracks().length);
  if (!hasCamera && !hasScreen) throw new Error("No tracks to publish");

  const { token, url, room: roomName, identity } = await getToken({
    role: "publisher",
    room: opts.roomName,
  });

  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(url, token);

  if (opts.cameraStream) {
    for (const t of opts.cameraStream.getTracks()) {
      await room.localParticipant.publishTrack(t, {
        source: t.kind === "video" ? Track.Source.Camera : Track.Source.Microphone,
      });
    }
  }
  if (opts.screenStream) {
    for (const t of opts.screenStream.getTracks()) {
      await room.localParticipant.publishTrack(t, {
        source: t.kind === "video" ? Track.Source.ScreenShare : Track.Source.ScreenShareAudio,
      });
    }
  }

  return {
    room,
    roomName,
    identity,
    hasCamera,
    hasScreen,
    close: () => { try { room.disconnect(); } catch { /* ignore */ } },
  };
}

export type SubscribeHandle = {
  room: Room;
  cameraStream: MediaStream;
  screenStream: MediaStream;
  close: () => void;
};

export async function subscribeToRoom(opts: {
  roomName: string;
  publisherIdentity?: string | null;
  onUpdate?: () => void;
}): Promise<SubscribeHandle> {
  const { token, url } = await getToken({ role: "subscriber", room: opts.roomName });
  const room = new Room({ adaptiveStream: true });
  const cameraStream = new MediaStream();
  const screenStream = new MediaStream();

  const attach = (track: RemoteTrack) => {
    const mediaTrack = track.mediaStreamTrack;
    if (!mediaTrack) return;
    if (track.source === Track.Source.ScreenShare || track.source === Track.Source.ScreenShareAudio) {
      screenStream.addTrack(mediaTrack);
    } else {
      cameraStream.addTrack(mediaTrack);
    }
    opts.onUpdate?.();
  };

  const detach = (track: RemoteTrack) => {
    const mediaTrack = track.mediaStreamTrack;
    if (!mediaTrack) return;
    cameraStream.removeTrack(mediaTrack);
    screenStream.removeTrack(mediaTrack);
    opts.onUpdate?.();
  };

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, _participant: RemoteParticipant) => {
    attach(track);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    detach(track);
  });

  await room.connect(url, token, { autoSubscribe: true });

  // Attach already-subscribed tracks
  room.remoteParticipants.forEach((p) => {
    p.trackPublications.forEach((pub) => {
      if (pub.track) attach(pub.track as RemoteTrack);
    });
  });

  return {
    room,
    cameraStream,
    screenStream,
    close: () => { try { room.disconnect(); } catch { /* ignore */ } },
  };
}
