
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  History, 
  Settings as SettingsIcon, 
  Plus, 
  X, 
  ChevronRight, 
  Trophy, 
  Trash2,
  Info,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { MealType, MealRecord, UserSettings, GoalType, FoodAnalysis } from './types';
import { MEAL_ORDER, COLORS } from './constants';
import { analyzeFoodImage, getDailyAdvice } from './geminiService';

// --- Sub-components (defined outside to avoid re-renders) ---

const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Snap your meal", desc: "Take a photo of your food and let Silk Kcal identify the nutrients.", icon: <Camera size={48} className="text-[#94C973]" /> },
    { title: "Track History", desc: "Keep a daily log of your caloric intake sorted by meal types.", icon: <History size={48} className="text-[#94C973]" /> },
    { title: "Reach Goals", desc: "Set your daily target and let AI provide insights to keep you on track.", icon: <Trophy size={48} className="text-[#94C973]" /> }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-8 p-6 bg-[#FDFCF8] rounded-full shadow-sm">
        {steps[step].icon}
      </div>
      <h2 className="text-2xl font-bold mb-4 text-[#2D3436]">{steps[step].title}</h2>
      <p className="text-gray-500 mb-12 max-w-xs">{steps[step].desc}</p>
      <div className="flex gap-2 mb-12">
        {steps.map((_, i) => (
          <div key={i} className={`h-2 w-2 rounded-full ${i === step ? 'bg-[#94C973] w-6' : 'bg-gray-200'} transition-all duration-300`} />
        ))}
      </div>
      <button 
        onClick={() => step < 2 ? setStep(s => s + 1) : onComplete()}
        className="w-full max-w-xs py-4 bg-[#94C973] text-white rounded-2xl font-semibold shadow-lg shadow-[#94C973]/20 active:scale-95 transition-transform"
      >
        {step === 2 ? "Get Started" : "Next"}
      </button>
    </div>
  );
};

const NutrientBar: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col gap-1 flex-1">
    <div className="flex justify-between text-xs font-medium text-gray-500 px-1">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: '60%', backgroundColor: color }} />
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<'camera' | 'history' | 'settings'>('camera');
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('silk_settings');
    return saved ? JSON.parse(saved) : { dailyTarget: 2000, goal: GoalType.MAINTAIN, onboardingComplete: false };
  });
  const [records, setRecords] = useState<MealRecord[]>(() => {
    const saved = localStorage.getItem('silk_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysis | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(MealType.BREAKFAST);
  const [toast, setToast] = useState<string | null>(null);
  const [dailyAdvice, setDailyAdvice] = useState<Record<string, string>>({});
  const [expandedRecord, setExpandedRecord] = useState<MealRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('silk_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('silk_records', JSON.stringify(records));
  }, [records]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      setCapturedImage(base64);
      setIsAnalyzing(true);
      try {
        const result = await analyzeFoodImage(base64Data);
        setAnalysisResult(result);
      } catch (err) {
        showToast("AI analysis failed. Please try again.");
        setCapturedImage(null);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveRecord = () => {
    if (!analysisResult) return;
    const newRecord: MealRecord = {
      ...analysisResult,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      mealType: selectedMealType,
      image: capturedImage || undefined,
      dateStr: new Date().toISOString().split('T')[0]
    };
    setRecords(prev => [newRecord, ...prev]);
    setAnalysisResult(null);
    setCapturedImage(null);
    showToast("Record saved!");
    setView('history');
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    showToast("Record deleted");
  };

  const clearAllHistory = () => {
    if (confirm("Are you sure you want to delete all history?")) {
      setRecords([]);
      showToast("All history cleared");
    }
  };

  const handleDailyAnalysis = async (date: string, dayRecords: MealRecord[]) => {
    const summary = dayRecords.map(r => `${r.mealType}: ${r.foodName} (${r.calories} kcal)`).join(', ');
    try {
      const advice = await getDailyAdvice(summary, settings.goal);
      setDailyAdvice(prev => ({ ...prev, [date]: advice }));
    } catch (err) {
      showToast("Advice could not be generated.");
    }
  };

  const groupedRecords = records.reduce((acc, curr) => {
    if (!acc[curr.dateStr]) acc[curr.dateStr] = [];
    acc[curr.dateStr].push(curr);
    return acc;
  }, {} as Record<string, MealRecord[]>);

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

  if (!settings.onboardingComplete) {
    return <Onboarding onComplete={() => setSettings(s => ({ ...s, onboardingComplete: true }))} />;
  }

  return (
    <div className="min-h-screen pb-24 text-[#2D3436]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-black/80 text-white rounded-full text-sm font-medium animate-bounce shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center px-6 pt-12 pb-4 bg-white/50 sticky top-0 z-40 backdrop-blur-sm">
        <h1 className="text-2xl font-bold italic tracking-tight text-[#94C973]">Silk Kcal</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('settings')} 
            className={`p-2 rounded-full transition-colors ${view === 'settings' ? 'bg-[#94C973] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6">
        {view === 'camera' && (
          <div className="flex flex-col items-center gap-8 py-10">
            <div className="relative w-full aspect-[3/4] rounded-[40px] overflow-hidden bg-gray-100 border-8 border-white shadow-2xl flex flex-col items-center justify-center group">
              {capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="Meal" />
              ) : (
                <div className="flex flex-col items-center text-gray-300">
                  <Camera size={80} strokeWidth={1.5} />
                  <p className="mt-4 font-medium text-gray-400">Capture your food</p>
                </div>
              )}
              
              {isAnalyzing && (
                <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center backdrop-blur-sm">
                  <div className="w-16 h-16 border-4 border-[#94C973] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-semibold text-[#94C973] animate-pulse">Analyzing with AI...</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              {!analysisResult && !isAnalyzing && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-20 h-20 bg-[#94C973] rounded-full flex items-center justify-center shadow-lg shadow-[#94C973]/30 active:scale-90 transition-transform"
                >
                  <div className="w-16 h-16 border-2 border-white/50 rounded-full flex items-center justify-center">
                    <Plus className="text-white" size={32} />
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleCapture}
                  />
                </button>
              )}

              {analysisResult && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                  <div 
                    className="absolute inset-0 bg-black/20" 
                    onClick={() => { setAnalysisResult(null); setCapturedImage(null); }}
                  />
                  <div className="glass rounded-t-[40px] p-8 pb-12 animate-slide-up transform translate-y-0 shadow-2xl">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-8" />
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-[#2D3436]">{analysisResult.foodName}</h3>
                        <p className="text-[#94C973] font-semibold text-lg">{analysisResult.calories} kcal</p>
                      </div>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                        {Object.values(MealType).map(m => (
                          <button
                            key={m}
                            onClick={() => setSelectedMealType(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedMealType === m ? 'bg-white text-[#94C973] shadow-sm' : 'text-gray-400'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-gray-500 text-sm mb-6 leading-relaxed italic">"{analysisResult.explanation}"</p>

                    <div className="flex gap-4 mb-8">
                      <NutrientBar label="Protein" value={analysisResult.protein} color="#FF7675" />
                      <NutrientBar label="Carbs" value={analysisResult.carbs} color="#74B9FF" />
                      <NutrientBar label="Fat" value={analysisResult.fat} color="#FDCB6E" />
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setAnalysisResult(null); setCapturedImage(null); }}
                        className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-500 active:scale-95 transition-transform"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={saveRecord}
                        className="flex-[2] py-4 bg-[#94C973] text-white rounded-2xl font-bold shadow-lg shadow-[#94C973]/20 active:scale-95 transition-transform"
                      >
                        Add to Journal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="py-6 flex flex-col gap-8">
            {sortedDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                <History size={64} strokeWidth={1} />
                <p className="mt-4 font-medium">No records yet</p>
              </div>
            ) : (
              sortedDates.map(date => {
                const dayRecords = groupedRecords[date].sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]);
                const totalCals = dayRecords.reduce((sum, r) => sum + r.calories, 0);
                const hasMainMeals = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER].every(type => dayRecords.some(r => r.mealType === type));

                return (
                  <div key={date} className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <h4 className="text-lg font-bold">
                        {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h4>
                      <div className="flex items-center gap-1 text-[#94C973] font-semibold">
                        <span>{totalCals}</span>
                        <span className="text-xs text-gray-400">/ {settings.dailyTarget} kcal</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {dayRecords.map(record => (
                        <div 
                          key={record.id} 
                          onClick={() => setExpandedRecord(record)}
                          className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100">
                              {record.image ? <img src={record.image} className="w-full h-full object-cover" /> : <Info className="m-auto text-gray-300" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#94C973] uppercase tracking-wider">{record.mealType}</p>
                              <p className="font-semibold text-gray-800">{record.foodName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-700">{record.calories} kcal</p>
                            <p className="text-xs text-gray-400">P:{record.protein} C:{record.carbs}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasMainMeals && (
                      <div className="mt-2">
                        {dailyAdvice[date] ? (
                          <div className="bg-[#F7FAFA] p-4 rounded-3xl border border-[#DCE8E8] relative overflow-hidden">
                            <Sparkles className="absolute -right-2 -top-2 text-[#94C973]/20 w-16 h-16" />
                            <h5 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                              <Sparkles size={14} className="text-[#94C973]" /> Daily Insight
                            </h5>
                            <p className="text-sm text-gray-600 leading-relaxed italic">{dailyAdvice[date]}</p>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleDailyAnalysis(date, dayRecords)}
                            className="w-full py-3 bg-[#EAF5E4] text-[#94C973] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                          >
                            <Sparkles size={18} /> Analyze Today's Intake
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="py-6 flex flex-col gap-8 animate-fade-in">
            <div className="bg-white p-8 rounded-[40px] shadow-xl shadow-gray-100">
              <h3 className="text-xl font-bold mb-8">Dietary Profile</h3>
              
              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-2 uppercase tracking-wide">Daily Target (kcal)</label>
                  <input 
                    type="number"
                    value={settings.dailyTarget}
                    onChange={(e) => setSettings(s => ({ ...s, dailyTarget: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xl font-bold focus:ring-2 focus:ring-[#94C973]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 block mb-2 uppercase tracking-wide">Your Goal</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.values(GoalType).map(g => (
                      <button
                        key={g}
                        onClick={() => setSettings(s => ({ ...s, goal: g }))}
                        className={`w-full py-4 px-6 rounded-2xl font-semibold flex justify-between items-center transition-all ${settings.goal === g ? 'bg-[#94C973] text-white shadow-lg shadow-[#94C973]/20' : 'bg-gray-50 text-gray-500'}`}
                      >
                        {g}
                        {settings.goal === g && <Trophy size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={clearAllHistory}
              className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-100 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={20} /> Clear All History
            </button>
          </div>
        )}
      </main>

      {/* Record Detail Modal */}
      {expandedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExpandedRecord(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl animate-scale-up">
            <button onClick={() => setExpandedRecord(null)} className="absolute top-6 right-6 p-2 bg-black/10 rounded-full text-white backdrop-blur-md z-10">
              <X size={20} />
            </button>
            <div className="h-64 bg-gray-100">
              {expandedRecord.image && <img src={expandedRecord.image} className="w-full h-full object-cover" />}
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{expandedRecord.foodName}</h3>
                  <p className="text-[#94C973] font-bold">{expandedRecord.calories} kcal • {expandedRecord.mealType}</p>
                </div>
                <button 
                  onClick={() => { deleteRecord(expandedRecord.id); setExpandedRecord(null); }} 
                  className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100"
                >
                  <Trash2 size={20} />
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">"{expandedRecord.explanation}"</p>
              <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-gray-50 p-4 rounded-3xl text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Protein</p>
                  <p className="font-bold text-[#FF7675]">{expandedRecord.protein}</p>
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-3xl text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Carbs</p>
                  <p className="font-bold text-[#74B9FF]">{expandedRecord.carbs}</p>
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-3xl text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Fat</p>
                  <p className="font-bold text-[#FDCB6E]">{expandedRecord.fat}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 text-center font-medium">Logged on {new Date(expandedRecord.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl flex justify-around items-center px-6 border-t border-gray-100 z-40">
        <button 
          onClick={() => setView('history')} 
          className={`flex flex-col items-center gap-1 transition-colors ${view === 'history' ? 'text-[#94C973]' : 'text-gray-300'}`}
        >
          <History size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Log</span>
        </button>
        <button 
          onClick={() => setView('camera')} 
          className="relative -top-6 w-16 h-16 bg-[#94C973] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#94C973]/30 border-[6px] border-[#FDFCF8]"
        >
          <Camera size={28} />
        </button>
        <button 
          onClick={() => setView('settings')} 
          className={`flex flex-col items-center gap-1 transition-colors ${view === 'settings' ? 'text-[#94C973]' : 'text-gray-300'}`}
        >
          <SettingsIcon size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Goal</span>
        </button>
      </nav>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-scale-up { animation: scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default App;
