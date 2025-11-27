export enum Difficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced'
}

export enum TaskType {
  FILL_IN_BLANK = 'Fill in the Blank',
  BUG_FIX = 'Bug Fix',
  PREDICT_OUTPUT = 'Predict Output'
}

export enum Topic {
  VARIABLES = 'Variables & Data Types',
  LOOPS = 'Loops (for, while)',
  ARRAYS = 'Arrays',
  OOP = 'OOP Concepts (Classes, Objects)',
  METHODS = 'Methods & Recursion',
  EXCEPTIONS = 'Exception Handling',
  STRINGS = 'String Manipulation',
  FILE_IO = 'File I/O',
  COLLECTIONS = 'Java Collections Framework'
}

export interface QuizConfig {
  difficulty: Difficulty;
  topic: Topic;
  taskType: TaskType;
  language: 'English' | 'Bulgarian';
}

export interface GeneratedQuestion {
  title: string;
  instructions: string;
  codeSnippet: string; // Contains ____ for blanks or buggy code
  initialCode: string; // Same as above, used for reset
  solution: string; // The correct code
  explanation: string;
}

export interface SimulationResult {
  output: string;
  isCorrect: boolean;
  feedback: string;
}

export interface ExamResult {
  grade: number; // 2, 3, 4, 5, 6
  label: string; // e.g. "Excellent", "Poor"
  feedback: string; // Detailed reasoning
  styleScore: number; // 0-100
  correctnessScore: number; // 0-100
}