import { Avatar } from "../../../components/ui/Avatar.jsx";
import { useMyPhoto } from "../../../hooks/useProfilePhotos.js";
import { ProfileDrawer } from "../../../components/ProfileDrawer.jsx";

export function StudentHeader({ page, accountOpen, setAccountOpen, profile, signOut, notify }) {
  const { url } = useMyPhoto(profile.id);
  return (
    <header className="student-header">
      <div className="student-header-inner">
        <a className="student-brand" href="#/student/home">
          <span>
            <img src="/assets/figma/c61c4.svg" alt="" />
          </span>
          <strong>Panther Pantry</strong>
        </a>
        <nav aria-label="Main">
          {[
            ["home", "Home"],
            ["request", "Request food"],
            ["history", "History"],
          ].map(([path, label]) => (
            <a
              href={`#/student/${path}`}
              key={path}
              aria-current={
                page === path || (path === "request" && page === "request-status")
                  ? "page"
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="student-account">
          <button
            className="student-avatar"
            aria-label="Your profile and sign out"
            aria-haspopup="dialog"
            onClick={() => setAccountOpen(true)}
          >
            <Avatar name={profile.name} src={url} size="md" />
          </button>
        </div>
      </div>
      {accountOpen && (
        <ProfileDrawer
          profile={profile}
          details={[
            ["Student ID", profile.studentId || "—"],
            [
              "ID card",
              profile.studentIdVerified
                ? "Checked by pantry staff"
                : "Not checked yet. Bring your student ID card to your first pickup.",
            ],
          ]}
          photoHint="Pantry staff see your photo when you pick up food, to help confirm it's you. Other students never see it."
          onClose={() => setAccountOpen(false)}
          signOut={signOut}
          notify={notify}
        />
      )}
    </header>
  );
}
