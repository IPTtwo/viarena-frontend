import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Require, RequireOrganizerWorkspace, Denied, NotFound } from './guards';
import { BrowsingShell, Shell } from '../components';
import { Landing } from '../pages/auth/Landing';
import { Auth } from '../pages/auth/Auth';
import { EventFeed } from '../pages/participant/EventFeed';
import { ArenaOverview } from '../pages/participant/ArenaOverview';
import { EventDetail } from '../pages/participant/EventDetail';
import { RegistrationRedirect } from '../pages/participant/RegistrationRedirect';
import { MyEvents } from '../pages/participant/MyEvents';
import { Profile } from '../pages/participant/Profile';
import { MyTeams } from '../pages/participant/MyTeams';
import { TeamDetail } from '../pages/participant/TeamDetail';
import { TeamTasks } from '../pages/participant/TeamTasks';
import { CalendarView } from '../pages/participant/CalendarView';
import { History } from '../pages/participant/History';
import { Certificates } from '../pages/participant/Certificates';
import { LiveNow } from '../pages/organizer/LiveNow';
import { WatchEvent } from '../pages/organizer/WatchEvent';
import { OrganizerDashboard } from '../pages/organizer/OrganizerDashboard';
import { OrganizerEvents } from '../pages/organizer/OrganizerEvents';
import { OrganizerRegistrations } from '../pages/organizer/OrganizerRegistrations';
import { EventEditor } from '../pages/organizer/EventEditor';
import { RegistrationManager } from '../pages/organizer/RegistrationManager';
import { EventTeams } from '../pages/organizer/EventTeams';
import { TeamRoleAssignment } from '../pages/organizer/TeamRoleAssignment';
import { ScheduleEditor } from '../pages/organizer/ScheduleEditor';
import { StreamSettings } from '../pages/organizer/StreamSettings';
import { ParticipationManager } from '../pages/organizer/ParticipationManager';
import { CoOrganizerManagement } from '../pages/organizer/CoOrganizerManagement';
import { AdminDashboard } from '../pages/admin/Dashboard';
import { AdminEvents } from '../pages/admin/Events';
import { AdminUsers } from '../pages/admin/Users';
import { AdminUserDetail } from '../pages/admin/UserDetail';
import { AuditLog } from '../pages/admin/AuditLog';

function AppLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function BrowsingLayout() {
  return (
    <BrowsingShell>
      <Outlet />
    </BrowsingShell>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/forgot-password" element={<Auth mode="forgot" />} />
      <Route path="/reset-password" element={<Auth mode="reset" />} />
      <Route path="/dashboard" element={<Navigate to="/events" replace />} />

      <Route element={<BrowsingLayout />}>
        <Route path="/events" element={<EventFeed />} />
        <Route path="/arena" element={<ArenaOverview />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/live" element={<LiveNow />} />
        <Route path="/events/:eventId/watch" element={<WatchEvent />} />
      </Route>

      <Route
        element={
          <Require>
            <AppLayout />
          </Require>
        }
      >
        <Route path="/events/:eventId/register" element={<RegistrationRedirect />} />
        <Route path="/my-events" element={<MyEvents />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<Profile edit />} />
        <Route path="/my-teams" element={<MyTeams />} />
        <Route path="/events/:eventId/teams/:teamId" element={<TeamDetail />} />
        <Route path="/events/:eventId/teams/:teamId/tasks" element={<TeamTasks />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/history" element={<History />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route
          path="/organizer"
          element={
            <Require role="Organizer">
              <OrganizerDashboard />
            </Require>
          }
        />
        <Route
          path="/organizer/events"
          element={
            <RequireOrganizerWorkspace>
              <OrganizerEvents />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/registrations"
          element={
            <RequireOrganizerWorkspace>
              <OrganizerRegistrations />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/new"
          element={
            <Require role="Organizer">
              <EventEditor />
            </Require>
          }
        />
        <Route
          path="/organizer/events/:eventId/edit"
          element={
            <RequireOrganizerWorkspace>
              <EventEditor />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/registrations"
          element={
            <RequireOrganizerWorkspace>
              <RegistrationManager />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/teams"
          element={
            <RequireOrganizerWorkspace>
              <EventTeams />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/teams/:teamId/roles"
          element={
            <RequireOrganizerWorkspace>
              <TeamRoleAssignment />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/schedule"
          element={
            <RequireOrganizerWorkspace>
              <ScheduleEditor />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/stream"
          element={
            <RequireOrganizerWorkspace>
              <StreamSettings />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/participation"
          element={
            <RequireOrganizerWorkspace>
              <ParticipationManager />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/organizer/events/:eventId/staff"
          element={
            <RequireOrganizerWorkspace>
              <CoOrganizerManagement />
            </RequireOrganizerWorkspace>
          }
        />
        <Route
          path="/admin"
          element={
            <Require role="Admin">
              <AdminDashboard />
            </Require>
          }
        />
        <Route
          path="/admin/users"
          element={
            <Require role="Admin">
              <AdminUsers />
            </Require>
          }
        />
        <Route
          path="/admin/users/:userId"
          element={
            <Require role="Admin">
              <AdminUserDetail />
            </Require>
          }
        />
        <Route
          path="/admin/events"
          element={
            <Require role="Admin">
              <AdminEvents />
            </Require>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <Require role="Admin">
              <AuditLog />
            </Require>
          }
        />
        <Route path="/403" element={<Denied />} />
      </Route>
      <Route path="/access" element={<Denied />} />
      <Route path="/admin/requests" element={<Denied />} />
      <Route path="/organizer/create" element={<Navigate to="/organizer/events/new" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
