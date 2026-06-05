import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type MonitorFrameKind = 'camera' | 'screen';

export type MonitorFramePayload = {
  kind: MonitorFrameKind;
  dataUrl: string;
  capturedAt: number;
  width: number;
  height: number;
};

export type FramePublisherHandle = {
  channel: RealtimeChannel;
  close: () => void;
};

export type FrameSubscriberHandle = {
  channel: RealtimeChannel;
  close: () => void;
};

const FRAME_INTERVAL_MS = 900;
const MAX_FRAME_WIDTH = 640;
const JPEG_QUALITY = 0.38;

const channelName = (sessionId: string) => `monitor-frames-${sessionId}`;

const createVideoElement = (stream: MediaStream) => {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  void video.play().catch(() => undefined);
  return video;
};

export function publishFrameSnapshots(opts: {
  sessionId: string;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
}): FramePublisherHandle {
  const channel = supabase.channel(channelName(opts.sessionId), {
    config: { broadcast: { ack: false, self: false } },
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const cameraVideo = opts.cameraStream?.getVideoTracks().length ? createVideoElement(opts.cameraStream) : null;
  const screenVideo = opts.screenStream?.getVideoTracks().length ? createVideoElement(opts.screenStream) : null;
  let intervalId: number | null = null;

  const publishFrame = (kind: MonitorFrameKind, video: HTMLVideoElement) => {
    if (!ctx || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const payload: MonitorFramePayload = {
      kind,
      dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      capturedAt: Date.now(),
      width,
      height,
    };
    void channel.send({ type: 'broadcast', event: 'frame', payload });
  };

  const tick = () => {
    if (screenVideo) publishFrame('screen', screenVideo);
    if (cameraVideo) publishFrame('camera', cameraVideo);
  };

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED' || intervalId !== null) return;
    tick();
    intervalId = window.setInterval(tick, FRAME_INTERVAL_MS);
  });

  return {
    channel,
    close: () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      [cameraVideo, screenVideo].forEach((video) => {
        if (!video) return;
        video.pause();
        video.srcObject = null;
      });
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

export function subscribeToFrameSnapshots(opts: {
  sessionId: string;
  onFrame: (frame: MonitorFramePayload) => void;
  onWaiting?: () => void;
}): FrameSubscriberHandle {
  const channel = supabase.channel(channelName(opts.sessionId), {
    config: { broadcast: { ack: false, self: false } },
  });

  channel
    .on('broadcast', { event: 'frame' }, (message) => {
      const payload = message.payload as Partial<MonitorFramePayload> | undefined;
      if (!payload?.dataUrl || (payload.kind !== 'camera' && payload.kind !== 'screen')) return;
      opts.onFrame(payload as MonitorFramePayload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') opts.onWaiting?.();
    });

  return {
    channel,
    close: () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}