export type LiveKitConnection = {
  disconnect: () => void;
};

export async function publishStudentTracks(options: {
  url?: string | null;
  token?: string | null;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  onDisconnected?: () => void;
}): Promise<LiveKitConnection | null> {
  if (!options.url || !options.token) return null;

  const livekit: any = await import('livekit-client');
  const room = new livekit.Room({ adaptiveStream: true, dynacast: true });
  room.on?.(livekit.RoomEvent?.Disconnected ?? 'disconnected', () => options.onDisconnected?.());
  await room.connect(options.url, options.token);

  const publishTrack = async (track: MediaStreamTrack, source: string) => {
    const wrapped = track.kind === 'video'
      ? new livekit.LocalVideoTrack(track)
      : new livekit.LocalAudioTrack(track);
    await room.localParticipant.publishTrack(wrapped, { source });
  };

  for (const track of options.cameraStream?.getTracks() ?? []) {
    await publishTrack(track, track.kind === 'audio' ? 'microphone' : 'camera');
  }
  for (const track of options.screenStream?.getTracks() ?? []) {
    await publishTrack(track, track.kind === 'audio' ? 'screen_share_audio' : 'screen_share');
  }

  return { disconnect: () => room.disconnect() };
}

export async function connectAdminViewer(options: {
  url?: string | null;
  token?: string | null;
  container: HTMLElement;
  onDisconnected?: () => void;
}): Promise<LiveKitConnection | null> {
  if (!options.url || !options.token) return null;

  const livekit: any = await import('livekit-client');
  const room = new livekit.Room({ adaptiveStream: true, dynacast: true });

  const attachPublication = (publication: any) => {
    const track = publication?.track;
    if (!track?.attach) return;
    const element = track.attach();
    element.className = 'rounded-lg bg-black w-full max-h-80 object-contain';
    options.container.appendChild(element);
  };

  room.on(livekit.RoomEvent.TrackSubscribed, (track: any) => {
    const element = track.attach();
    element.className = 'rounded-lg bg-black w-full max-h-80 object-contain';
    options.container.appendChild(element);
  });
  room.on(livekit.RoomEvent.TrackUnsubscribed, (track: any) => track.detach?.().forEach((el: HTMLElement) => el.remove()));
  room.on(livekit.RoomEvent.Disconnected, () => options.onDisconnected?.());

  await room.connect(options.url, options.token);
  room.remoteParticipants.forEach((participant: any) => {
    participant.trackPublications?.forEach(attachPublication);
  });

  return { disconnect: () => room.disconnect() };
}
