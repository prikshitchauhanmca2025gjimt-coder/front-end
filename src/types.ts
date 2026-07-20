export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

export interface SubjectTopic {
  id: string;
  title: string;
  prompt: string;
}

export interface CuratedSubject {
  id: string;
  name: string;
  iconName: string;
  description: string;
  topics: SubjectTopic[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  explanation: string;
}

export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswers: { [key: number]: number }; // questionIndex -> selectedOptionIndex
  isSubmitted: boolean;
}
