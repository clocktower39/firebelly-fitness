export let user = {
    isTrainer: false,
    themeMode: localStorage.getItem('theme'),
    customThemes: [],
    workoutWeightUnit: "lbs",
    defaultSessionLengthMinutes: 60,
    autoPaymentReminders: false,
    timezone: "",
    notificationPrefs: {
        clientWorkoutCompleted: true,
        goalMet: true,
        workoutReminder: true,
        workoutReminderTime: "08:00",
        workoutReminderPerDay: false,
        workoutReminderTimesByDay: [],
        workoutOverdue: true,
        workoutOverdueAfterMinutes: 180,
        sessionReminder: true,
        sessionReminderLeadMinutes: 120,
        measurementReminder: false,
        measurementCadence: "MONTHLY",
    },
}

export let exerciseLibrary = [];

export let workouts = {
    // user_id: {
    //     workouts: [ ...workouts ]
    // }
};

export let training = {
    category: "",
    training: [],
    workoutType: "Strength",
    cardio: {},
};

export let progress = {
    exerciseList: [],
    exerciseSummariesByUser: {},
    exerciseAliases: {},
    exerciseAliasesLoaded: false,
    exerciseFavorites: [],
    exerciseFavoritesLoaded: false,
}

export let clients = [];
export let myTrainers = [];
export let trainers = [];
export let goals = [];

export let conversations = [];

export let metrics = {
    entriesByUser: {},
    pendingByUser: {},
    latestByUser: {},
};

export let scheduleEvents = {
    // scopeKey: {
    //   events: [ ...events ],
    //   range: { startDate, endDate },
    // }
};

export let sessionSummary = {};

export let workoutQueue = {
    // accountId: [ ...workouts ]
};

export let lastBulkOperation = null;

export let readiness = {
    entries: [],
    loaded: false,
};
