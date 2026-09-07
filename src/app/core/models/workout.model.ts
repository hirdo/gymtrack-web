// 'reps' = sets x reps x weight, 'reps_only' = sets x reps (no weight), 'duration' = sets x duration
export type ExerciseTrackingType = 'reps' | 'reps_only' | 'duration';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: number;
  weight?: number;
  duration?: number;
  restTime?: number;
  notes?: string;
  imageUrl?: string;
  templateId?: string;
  trackingType?: ExerciseTrackingType;
  alternativeExerciseIds?: string[];
}

export interface Workout {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  scheduledDate?: string;
  completedDate?: string;
  durationMinutes?: number;
  category: WorkoutCategory;
  programId?: string;
  programRunId?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkoutCategory =
  | 'strength'
  | 'cardio'
  | 'flexibility'
  | 'hiit'
  | 'custom';

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves';

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable'
  | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export interface ExerciseTemplate {
  id: string;
  name: string;
  category: WorkoutCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  trackingType?: ExerciseTrackingType;
  recommendedReps?: number;
  recommendedWeight?: number;
  recommendedDuration?: number;
  imageUrl?: string;
  instructions?: string;
  isCustom?: boolean;
  createdBy?: string;
}

export interface SetRecord {
  setNumber: number;
  weight?: number;
  reps?: number;
  duration?: number;
  completedAt: string;
  isWarmup?: boolean;
}

export interface ExerciseLog {
  id: string;
  userId: string;
  workoutId: string;
  exerciseIndex: number;
  exerciseTemplateId?: string;
  exerciseName: string;
  trackingType?: ExerciseTrackingType;
  date: string;
  targetSets: number;
  targetReps?: number;
  targetWeight?: number;
  targetDuration?: number;
  restTime?: number;
  sets: SetRecord[];
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramDay {
  dayNumber: number;
  name: string;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    trackingType?: ExerciseTrackingType;
    targetSets: number;
    targetReps?: number;
    targetWeight?: number;
    targetDuration?: number;
    restTime?: number;
    alternativeExerciseIds?: string[];
  }[];
}

export type ProgramDifficulty = 'no_experience' | 'beginner' | 'intermediate' | 'advanced' | 'pro';

export const PROGRAM_DIFFICULTIES: { value: ProgramDifficulty; label: string; stars: number }[] = [
  { value: 'no_experience', label: 'No Experience', stars: 1 },
  { value: 'beginner', label: 'Beginner', stars: 2 },
  { value: 'intermediate', label: 'Intermediate', stars: 3 },
  { value: 'advanced', label: 'Advanced', stars: 4 },
  { value: 'pro', label: 'Pro', stars: 5 }
];

export interface TrainingProgram {
  id: string;
  userId: string;
  name: string;
  description?: string;
  difficulty: ProgramDifficulty;
  totalDays: number;
  sessionsPerWeek: number;
  days: ProgramDay[];
  isActive?: boolean;
  currentDay?: number;
  completedSessions?: number;
  createdAt: string;
  updatedAt: string;
}
