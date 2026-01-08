
export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner',
  SNACK = 'Snack'
}

export enum GoalType {
  LOSE_WEIGHT = 'Lose Weight',
  MAINTAIN = 'Maintain',
  GAIN_MUSCLE = 'Gain Muscle'
}

export interface FoodAnalysis {
  foodName: string;
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  explanation: string;
}

export interface MealRecord extends FoodAnalysis {
  id: string;
  timestamp: number;
  mealType: MealType;
  image?: string;
  dateStr: string; // YYYY-MM-DD
}

export interface UserSettings {
  dailyTarget: number;
  goal: GoalType;
  onboardingComplete: boolean;
}

export interface DailySummary {
  date: string;
  records: MealRecord[];
}
