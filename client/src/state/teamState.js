import { useStoredState } from './storage';

export function useTeamState() {
  const [teams, setTeams] = useStoredState('teams', []);
  const [tasks, setTasks] = useStoredState('tasks', []);
  const [schedules, setSchedules] = useStoredState('schedules', []);
  const [attendance, setAttendance] = useStoredState('attendance', []);
  const [joinCodes, setJoinCodes] = useStoredState('join_codes', []);

  return {
    teams,
    setTeams,
    tasks,
    setTasks,
    schedules,
    setSchedules,
    attendance,
    setAttendance,
    joinCodes,
    setJoinCodes,
  };
}
