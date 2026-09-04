import { RequireModerator } from './ModeratorLogin';
import ModeratorQueue from './ModeratorQueue';

// Single entry point for the moderator area so one lazy import pulls the gate,
// the queue, its CSS and the contributor-stats table into one chunk that no
// anonymous visitor ever downloads.
export default function AdminRoute() {
  return (
    <RequireModerator>
      <ModeratorQueue />
    </RequireModerator>
  );
}
