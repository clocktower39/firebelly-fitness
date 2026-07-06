import React, { Suspense, lazy, useState, useEffect } from "react";
import { getAccessToken } from "./api/client";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from "react-router-dom";
import { ThemeProvider, GlobalStyles } from "@mui/material";
import { theme } from "./theme";
import {
  getConversations,
  receiveSocketMessage,
  receiveSocketDeletedMessage,
  removeWorkouts,
  requestClients,
  serverURL,
  upsertWorkout,
} from "./Redux/actions";
import { updateUserSettings } from "./Redux/actions/accountActions";
import socketIOClient from "socket.io-client";
import AuthRoute from "./Components/AuthRoute";
const WebsiteNavbar = lazy(() => import("./Pages/WebsitePages/WebsiteNavbar"));
const WebsiteHome = lazy(() => import("./Pages/WebsitePages/WebsiteHome"));
const NutritionInfo = lazy(() => import("./Pages/WebsitePages/Nutrition"));
const Workshops = lazy(() => import("./Pages/WebsitePages/Workshops"));
const TrainingInfo = lazy(() => import("./Pages/WebsitePages/TrainingInfo"));
const PublicSchedule = lazy(() => import("./Pages/WebsitePages/PublicSchedule"));
const Login = lazy(() => import("./Pages/Login"));
const SignUp = lazy(() => import("./Pages/SignUp"));
const VerifyEmail = lazy(() => import("./Pages/VerifyEmail"));
const Home = lazy(() => import("./Pages/AppPages/Home"));
const Messages = lazy(() => import("./Pages/AppPages/Messages"));
const Notifications = lazy(() => import("./Pages/AppPages/Notifications"));
const Feedback = lazy(() => import("./Pages/AppPages/Feedback"));
const FeedbackInbox = lazy(() => import("./Pages/AppPages/FeedbackInbox"));
const Coverage = lazy(() => import("./Pages/AppPages/Coverage"));
const Workout = lazy(() => import("./Pages/AppPages/Workout"));
const Calendar = lazy(() => import("./Pages/AppPages/Calendar"));
const Schedule = lazy(() => import("./Pages/AppPages/Schedule"));
const ProgramBuilder = lazy(() => import("./Pages/AppPages/ProgramBuilder"));
const Programs = lazy(() => import("./Pages/AppPages/Programs"));
const ProgramsMarketplacePreview = lazy(() => import("./Pages/AppPages/ProgramsMarketplacePreview"));
const WorkoutTemplates = lazy(() => import("./Pages/AppPages/WorkoutTemplates"));
const WorkoutHistory = lazy(() => import("./Pages/AppPages/WorkoutHistory"));
const Exercises = lazy(() => import("./Pages/AppPages/Exercises"));
const ExerciseLibrary = lazy(() => import("./Pages/AppPages/ExerciseLibrary"));
const ExerciseDetail = lazy(() => import("./Pages/AppPages/ExerciseDetail"));
const Clients = lazy(() => import("./Pages/AppPages/Clients"));
const Groups = lazy(() => import("./Pages/AppPages/Groups"));
const GroupDetail = lazy(() => import("./Pages/AppPages/GroupDetail"));
const GroupInviteAccept = lazy(() => import("./Pages/AppPages/GroupInviteAccept"));
const Progress = lazy(() => import("./Pages/AppPages/Progress"));
const Goals = lazy(() => import("./Pages/AppPages/Goals"));
const Account = lazy(() => import("./Pages/AppPages/Account"));
const Invoices = lazy(() => import("./Pages/AppPages/Invoices"));
const Products = lazy(() => import("./Pages/AppPages/Products"));
const TrainerStore = lazy(() => import("./Pages/AppPages/TrainerStore"));
const MyAccount = lazy(() => import("./Components/AccountComponents/MyAccount"));
const ThemeSettings = lazy(() => import("./Components/AccountComponents/ThemeSettings"));
const Trainers = lazy(() => import("./Components/AccountComponents/Trainers"));
const ChangePassword = lazy(() => import("./Components/AccountComponents/ChangePassword"));
const LogoutConfirmation = lazy(() => import("./Components/AccountComponents/LogoutConfirmation"));
const WorkoutPreferences = lazy(() => import("./Components/AccountComponents/WorkoutPreferences"));
const NotificationPreferences = lazy(() => import("./Components/AccountComponents/NotificationPreferences"));
const TrainerSchedulingPreferences = lazy(() => import("./Components/AccountComponents/TrainerSchedulingPreferences"));
const TrainerBillingPreferences = lazy(() => import("./Components/AccountComponents/TrainerBillingPreferences"));
const GuardianDashboard = lazy(() => import("./Components/AccountComponents/GuardianDashboard"));
const ActivityTrackerContainer = lazy(() => import("./Pages/AppPages/ActivityTrackerContainer"));
import PagePresenceAvatars from "./Components/PagePresenceAvatars";
const NotFoundPage = lazy(() => import("./Pages/NotFoundPage"));
import "./App.css";

const getSocketURL = () => {
  if (serverURL === "/api") {
    return typeof window !== "undefined" ? window.location.origin : undefined;
  }
  return serverURL;
};

function App({ }) {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.user.themeMode);
  const [themeSelection, setThemeSelection] = useState(theme());

  const userId = useSelector((state) => state.user._id);
  const isTrainer = useSelector((state) => state.user.isTrainer);
  const userTimezone = useSelector((state) => state.user.timezone);
  // In a view-only (guardian→child) or delegated (trainer→client) session we must NOT auto-write
  // settings: the write would 403 and bounce the session back to the parent, and it would set the
  // wrong user's timezone anyway.
  const sessionIsDelegated = useSelector(
    (state) => Boolean(state.user.viewOnly) || Boolean(state.user.delegationMode)
  );
  const workoutAccountIds = useSelector((state) => {
    const ids = new Set();
    if (state.user?._id) ids.add(String(state.user._id));

    Object.keys(state.workouts || {}).forEach((accountId) => {
      if (accountId) ids.add(String(accountId));
    });

    (state.clients || []).forEach((clientRel) => {
      const clientId = clientRel?.client?._id || clientRel?.client;
      if (clientRel?.accepted && clientId) ids.add(String(clientId));
    });

    return Array.from(ids).sort();
  }, shallowEqual);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (userId) {
      const newSocket = socketIOClient(getSocketURL(), {
        path: "/socket.io",
        auth: { token: getAccessToken() },
        transports: ["websocket"],
        upgrade: false,
      });
      setSocket(newSocket);

      return () => newSocket.disconnect(); // Cleanup on unmount
    }
  }, [userId]);

  useEffect(() => {
    if (isTrainer) {
      dispatch(requestClients());
    }
  }, [dispatch, isTrainer]);

  // Load conversations on boot so the unread badge is accurate app-wide.
  useEffect(() => {
    if (userId) dispatch(getConversations());
  }, [dispatch, userId]);

  // Capture the user's timezone once (so local-time reminders fire correctly), if not set.
  // Skipped in delegated/view-only sessions (see sessionIsDelegated above).
  useEffect(() => {
    if (!userId || userTimezone || sessionIsDelegated) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) dispatch(updateUserSettings({ timezone: tz }));
    } catch (e) {
      /* ignore */
    }
  }, [userId, userTimezone, sessionIsDelegated, dispatch]);

  useEffect(() => {
    if (!socket) return;

    const handleWorkoutUpdated = (payload) => {
      const workout = payload?.workout || payload?.updatedWorkout;
      if (!workout?._id) return;
      dispatch(upsertWorkout(workout, payload.accountId));
    };
    const handleWorkoutDeleted = (payload) => {
      if (!payload?.accountId || !payload?.workoutId) return;
      dispatch(removeWorkouts(payload.accountId, [payload.workoutId]));
    };

    const handleNotification = (notification) => {
      // Bridge to the NotificationBell (decoupled from this socket's local scope).
      window.dispatchEvent(new CustomEvent("fb:notification", { detail: notification }));
    };

    const handleMessageNew = (payload) => {
      if (payload?.conversationId) dispatch(receiveSocketMessage(payload));
    };
    const handleMessageDeleted = (payload) => {
      if (payload?.conversationId) dispatch(receiveSocketDeletedMessage(payload));
    };

    socket.on("workoutUpdated", handleWorkoutUpdated);
    socket.on("workoutDeleted", handleWorkoutDeleted);
    socket.on("notification", handleNotification);
    socket.on("message:new", handleMessageNew);
    socket.on("message:deleted", handleMessageDeleted);
    return () => {
      socket.off("workoutUpdated", handleWorkoutUpdated);
      socket.off("workoutDeleted", handleWorkoutDeleted);
      socket.off("notification", handleNotification);
      socket.off("message:new", handleMessageNew);
      socket.off("message:deleted", handleMessageDeleted);
    };
  }, [dispatch, socket]);

  useEffect(() => {
    if (!socket || workoutAccountIds.length === 0) return;

    workoutAccountIds.forEach((accountId) => {
      socket.emit("joinWorkoutAccount", { accountId });
    });

    return () => {
      workoutAccountIds.forEach((accountId) => {
        socket.emit("leaveWorkoutAccount", { accountId });
      });
    };
  }, [socket, workoutAccountIds]);

  const checkSubDomain = () => {
    if (import.meta.env.VITE_SITE_MODE === "www") {
      return true;
    }

    let host = window.location.host;
    let parts = host.split(".");
    let subdomain = "";
    // If we get more than 3 parts, then we have a subdomain
    // INFO: This could be 4, if you have a co.uk TLD or something like that.
    if (parts.length >= 3) {
      subdomain = parts[0];
      // Remove the subdomain from the parts list
      parts.splice(0, 1);
      // Set the location to the new url
    }
    // end line with false : true for production
    return subdomain === "app" ||
      subdomain === "dev" ||
      subdomain === "172" ||
      subdomain === "192" ||
      subdomain === "10" ||
      host === "localhost:3000"
      ? false
      : true;
  };

  useEffect(() => {
    setThemeSelection(theme());
  }, [themeMode]);

  return (
    <ThemeProvider theme={themeSelection}>
      <GlobalStyles
        styles={(theme) => ({
          html: {
            backgroundColor: theme.palette.background.default,
            minHeight: "100vh",
          },
          body: {
            backgroundColor: theme.palette.background.default,
            minHeight: "100vh",
            margin: 0,
          },
          "#root": {
            backgroundColor: theme.palette.background.default,
            minHeight: "100vh",
          },
        })}
      />
      <Router>
        <PagePresenceAvatars socket={socket} />
        <Suspense fallback={null}>
          <Routes>
            {/* Default website pages, anyone can access */}
            {checkSubDomain() ? (
              <>
                <Route exact path="/" element={<WebsiteHome />} />
                <Route exact path="/nutrition" element={<NutritionInfo />} />
                <Route exact path="/workshops" element={<Workshops />} />
                <Route exact path="/training" element={<TrainingInfo />} />
                <Route exact path="/public/sessions/:trainerId" element={<PublicSchedule />} />
                <Route exact path="/public/schedule/:trainerId" element={<PublicScheduleRedirect />} />

                <Route path="*" element={<><WebsiteNavbar /><NotFoundPage /></>} />
              </>
            ) : (
              <>
                {" "}
                {/* App */}
                <Route element={<ActivityTrackerContainer />}>
                <Route exact path="/login" element={<Login />} />
                <Route exact path="/signup" element={<SignUp />} />
                <Route exact path="/groups/invite" element={<GroupInviteAccept />} />
                <Route exact path="/public/sessions/:trainerId" element={<PublicSchedule />} />
                  <Route exact path="/public/schedule/:trainerId" element={<PublicScheduleRedirect />} />

                  {/* Must be logged in and have JWT token to authenticate */}
                  <Route exact element={<AuthRoute />}>
                    <Route exact path="/" element={<Home />} />
                    <Route exact path="/coverage" element={<Coverage />} />
                    <Route exact path="/workoutHistory" element={<WorkoutHistory />} />
                    <Route exact path="/calendar" element={<Calendar />} />
                    <Route exact path="/workout-templates" element={<WorkoutTemplates />} />
                    <Route exact path="/sessions" element={<Schedule />} />
                    <Route exact path="/schedule" element={<Navigate to="/sessions" replace />} />
                    <Route exact path="/workout/:_id" element={<Workout socket={socket} />} />
                    <Route exact path="/progress" element={<Progress />} />
                    <Route exact path="/goals" element={<Goals />} />
                    <Route exact path="/messages" element={<Messages />} />
                    <Route exact path="/notifications" element={<Notifications />} />
                    <Route exact path="/feedback" element={<Feedback />} />
                    <Route exact path="/admin/feedback" element={<FeedbackInbox />} />
                    <Route exact path="/exercises" element={<Exercises />} />
                    <Route exact path="/exercise-library" element={<ExerciseLibrary />} />
                    <Route exact path="/exercise-library/:id" element={<ExerciseDetail />} />
                    <Route exact path="/invoices" element={<Invoices />} />
                    <Route exact path="/session-counter" element={<Navigate to="/invoices" replace />} />
                    <Route exact path="/products" element={<Products />} />
                    <Route exact path="/trainer-store" element={<TrainerStore />} />
                    <Route exact path="/programs" element={<Programs />} />
                    <Route exact path="/programs/marketplace-preview" element={<ProgramsMarketplacePreview />} />
                    <Route exact path="/programs/builder" element={<ProgramBuilder />} />
                    <Route exact path="/programs/:programId/edit" element={<ProgramBuilder />} />
                    <Route exact path="/groups" element={<Groups />} />
                    <Route exact path="/groups/:groupId" element={<GroupDetail />} />

                    <Route exact path="/account/*" element={<Account />}>
                      <Route index={true} exact path="" element={<MyAccount />} />
                      <Route index={true} exact path="theme" element={<ThemeSettings />} />
                      <Route index={true} exact path="workout-preferences" element={<WorkoutPreferences />} />
                      <Route index={true} exact path="notifications" element={<NotificationPreferences />} />
                      <Route index={true} exact path="trainer-scheduling" element={<TrainerSchedulingPreferences />} />
                      <Route index={true} exact path="trainer-billing" element={<TrainerBillingPreferences />} />
                      <Route
                        index={true}
                        exact
                        path="trainer-connections"
                        element={<Navigate to="/account/trainers" replace />}
                      />
                      <Route index={true} exact path="family" element={<GuardianDashboard />} />
                      <Route
                        index={true}
                        exact
                        path="trainers"
                        element={<Trainers socket={socket} />}
                      />
                      <Route index={true} exact path="password" element={<ChangePassword />} />
                      <Route index={true} exact path="logout" element={<LogoutConfirmation />} />
                    </Route>

                    <Route exact path="/clients" element={<Clients socket={socket} />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </>
            )}
            <Route element={<ActivityTrackerContainer />}>
              <Route exact path="/verify-email" element={<VerifyEmail />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

function PublicScheduleRedirect() {
  const { trainerId } = useParams();
  return <Navigate to={`/public/sessions/${trainerId}`} replace />;
}

export default App;
