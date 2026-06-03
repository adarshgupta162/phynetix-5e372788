Plan to replace the failing LiveKit stream path with Supabase Realtime WebRTC signaling:

1. Add a new WebRTC signaling helper
   - Create a Supabase Realtime channel per monitoring session, e.g. `monitoring-webrtc:{sessionId}`.
   - Student side listens for `viewer-request` from admin.
   - Student creates an `RTCPeerConnection`, attaches camera/screen/mic tracks, sends an SDP offer through Realtime broadcast.
   - Admin receives offer, creates answer, exchanges ICE candidates, and renders camera/screen tracks.
   - Keep a small peer map so the student can handle refresh/reconnect and more than one admin viewer.

2. Update student proctoring startup
   - Remove LiveKit publishing from `useProctoring.ts`.
   - Start the Supabase WebRTC broadcaster after the monitoring session row is created.
   - Store `provider: 'supabase-webrtc'` and device availability in `monitoring_sessions.metadata`.
   - Keep heartbeats and security event logging unchanged.
   - If WebRTC setup fails, keep the monitoring session visible and show a clear stream status instead of hiding the candidate.

3. Update Admin → Live Monitoring viewer
   - Replace LiveKit subscriber code with the new Supabase Realtime viewer.
   - When admin clicks a candidate, send `viewer-request` and wait for the student browser to respond.
   - Show live camera/screen when connected.
   - Keep candidate details visible regardless of stream state: exited time/fullscreen exits, time left, elapsed time, current question, attempted/visited/not visited counts, events, heartbeat, and device status.

4. Remove LiveKit-specific UI/error messaging
   - Replace “invalid token / LiveKit” errors with Realtime/WebRTC statuses: connecting, waiting for student browser, live, disconnected, or browser/network blocked.
   - Stop depending on `livekit-token` for the normal monitoring path.

Technical notes
- This avoids LiveKit secrets completely.
- It uses the existing logged-in student/admin browser sessions and existing `monitoring_sessions` discovery table.
- Since this is peer-to-peer WebRTC without TURN, it should work on most normal networks, but can still fail on strict corporate/firewall networks. The candidate details and live session visibility will still work even if video negotiation fails.