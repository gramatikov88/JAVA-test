import React, { useState, useEffect, useRef } from 'react';
import { 
  Difficulty, 
  Topic, 
  TaskType, 
  QuizConfig, 
  GeneratedQuestion, 
  SimulationResult,
  ExamResult
} from './types';
import { generateQuestion, simulateJavaCode, gradeExam } from './services/geminiService';
import { Editor, EditorFile } from './components/Editor';
import { Loading } from './components/Loading';

export default function App() {
  // Application State
  const [config, setConfig] = useState<QuizConfig>({
    difficulty: Difficulty.BEGINNER,
    topic: Topic.VARIABLES,
    taskType: TaskType.FILL_IN_BLANK,
    language: 'English'
  });

  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [userCode, setUserCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('Main.java');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  
  // Metrics State
  const [startTime, setStartTime] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const timerRef = useRef<number | null>(null);

  // Timer Logic
  useEffect(() => {
    if (question && !examResult) {
      setStartTime(Date.now());
      setElapsedTime(0);
      setAttempts(0);
      
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [question, examResult]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handlers
  const handleStartQuiz = async () => {
    setIsGenerating(true);
    setError(null);
    setSimulationResult(null);
    setExamResult(null);
    try {
      const q = await generateQuestion(config);
      setQuestion(q);
      setUserCode(q.codeSnippet);
      setActiveTab('Main.java');
    } catch (e: any) {
      setError(e.message || "Failed to generate question. Please check API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCode = async () => {
    if (!question) return;
    setIsSimulating(true);
    setSimulationResult(null);
    setAttempts(prev => prev + 1);
    
    try {
      const result = await simulateJavaCode(userCode, question, config.language);
      setSimulationResult(result);
    } catch (e: any) {
      setError(e.message || "Failed to simulate code.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleFinishExam = async () => {
    if (!question) return;
    setIsGrading(true);
    try {
      const result = await gradeExam(
        userCode, 
        question, 
        { timeSpentSeconds: elapsedTime, attempts }, 
        config.language
      );
      setExamResult(result);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (e: any) {
      setError(e.message || "Failed to grade exam.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleReset = () => {
    if (question) {
      setUserCode(question.initialCode);
      setSimulationResult(null);
      setAttempts(prev => prev + 1); // Reset counts as an attempt usage conceptually
    }
  };

  const handleBackToSetup = () => {
    setQuestion(null);
    setUserCode('');
    setSimulationResult(null);
    setExamResult(null);
    setError(null);
  };

  // Prepare files for editor
  const editorFiles: EditorFile[] = [
    { name: 'Main.java', language: 'java', content: userCode }
  ];

  // Render Helpers
  const renderSetup = () => (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
      <div className="max-w-xl w-full bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-200">
            JavaMaster AI
          </h1>
          <p className="text-slate-400 mt-2">Generate custom Java coding challenges</p>
        </div>

        <div className="space-y-6">
          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Interface Language</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setConfig({ ...config, language: 'English' })}
                className={`p-3 rounded-lg border text-sm transition-all ${config.language === 'English' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
              >
                English
              </button>
              <button
                onClick={() => setConfig({ ...config, language: 'Bulgarian' })}
                className={`p-3 rounded-lg border text-sm transition-all ${config.language === 'Bulgarian' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
              >
                Български
              </button>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Difficulty</label>
            <select 
              value={config.difficulty}
              onChange={(e) => setConfig({ ...config, difficulty: e.target.value as Difficulty })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Topic</label>
            <select 
              value={config.topic}
              onChange={(e) => setConfig({ ...config, topic: e.target.value as Topic })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {Object.values(Topic).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Task Type</label>
            <select 
              value={config.taskType}
              onChange={(e) => setConfig({ ...config, taskType: e.target.value as TaskType })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {Object.values(TaskType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button 
            onClick={handleStartQuiz}
            disabled={isGenerating}
            className="w-full mt-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Start Challenge'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (!question) return null;

    return (
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        
        {/* LEFT COLUMN: Console & Feedback (30%) */}
        <div className="lg:w-[30%] bg-slate-950 border-r border-slate-800 flex flex-col h-full z-10 shadow-xl">
           <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
             <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {config.language === 'Bulgarian' ? 'Терминал & Резултати' : 'Terminal & Results'}
             </span>
             <button 
                onClick={handleBackToSetup}
                className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-2 py-1 rounded bg-orange-500/10"
              >
                {config.language === 'Bulgarian' ? 'Нова Задача' : 'New Task'}
              </button>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {!simulationResult ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-sm font-mono">{config.language === 'Bulgarian' ? 'Очаква се изпълнение...' : 'Waiting for execution...'}</p>
                 </div>
              ) : (
                <>
                  {/* Feedback Card */}
                  <div className={`p-4 rounded-lg border ${simulationResult.isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {simulationResult.isCorrect 
                        ? <span className="text-green-400 font-bold flex items-center gap-1"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> PASSED</span>
                        : <span className="text-red-400 font-bold flex items-center gap-1"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> FAILED</span>
                      }
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {simulationResult.feedback}
                    </p>
                  </div>

                  {/* Console Output */}
                  <div>
                    <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-mono">Stdout</div>
                    <div className="bg-black/50 rounded p-3 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap break-all shadow-inner">
                      {simulationResult.output || <span className="italic text-slate-600">No output</span>}
                    </div>
                  </div>

                  {/* Explanation (if correct) */}
                  {simulationResult.isCorrect && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <div className="text-xs text-orange-400 mb-1 uppercase tracking-wider font-bold">{config.language === 'Bulgarian' ? 'Обяснение' : 'Explanation'}</div>
                      <p className="text-sm text-slate-400">{question.explanation}</p>
                    </div>
                  )}
                </>
              )}
           </div>
        </div>

        {/* RIGHT COLUMN: Task & Editor (70%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          
          {/* Top Panel: Task Description (Above Editor) */}
          <div className="shrink-0 p-5 bg-slate-900 border-b border-slate-800 shadow-sm relative flex justify-between items-start">
             <div className="flex-1">
                <h2 className="text-lg font-bold text-white mb-1">{question.title}</h2>
                <div className="flex items-center gap-2 mb-3">
                   <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">{config.difficulty}</span>
                   <span className="px-2 py-0.5 rounded text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800 uppercase tracking-wide">{config.taskType}</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-orange-500 pl-3">
                  {question.instructions}
                </p>
             </div>
             
             {/* Stats Display */}
             <div className="ml-4 flex flex-col items-end text-xs font-mono text-slate-500 bg-slate-950 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                   <span>Time:</span>
                   <span className="text-white font-bold">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span>Attempts:</span>
                   <span className="text-white font-bold">{attempts}</span>
                </div>
             </div>
          </div>

          {/* Middle Panel: Editor (Flex Grow) */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            <Editor 
              files={editorFiles}
              activeFileName={activeTab}
              onFileChange={setActiveTab}
              onCodeChange={(_, newCode) => setUserCode(newCode)}
              readOnly={!!examResult}
            />
          </div>
          
          {/* Bottom Bar: Actions */}
          <div className="shrink-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6">
             <button 
                onClick={handleReset}
                disabled={!!examResult}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-30"
                title="Reset to initial state"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {config.language === 'Bulgarian' ? 'Рестарт' : 'Reset'}
              </button>

             <div className="flex items-center gap-4">
                {/* Run Button (Check Logic) */}
                <button 
                  onClick={handleRunCode}
                  disabled={isSimulating || !!examResult}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 rounded text-sm font-bold text-slate-200 border border-slate-700
                    hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50
                  `}
                >
                   {isSimulating ? (
                     <span>Wait...</span>
                   ) : (
                     <>
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                       <span>{config.language === 'Bulgarian' ? 'Тествай' : 'Test Run'}</span>
                     </>
                   )}
                </button>

                {/* FINISH / GRADE Button */}
                <button 
                    onClick={handleFinishExam}
                    disabled={isGrading || !!examResult}
                    className={`
                      flex items-center gap-2 px-8 py-2.5 rounded text-sm font-bold text-white shadow-lg 
                      transform transition-all active:scale-95
                      ${isGrading || !!examResult
                        ? 'bg-slate-700 cursor-not-allowed opacity-80' 
                        : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 hover:shadow-orange-500/20'}
                    `}
                  >
                    {isGrading ? (
                      <>
                         <div className="w-4 h-4 border-2 border-white/30 border-l-white rounded-full animate-spin"></div>
                         <span>Grading...</span>
                      </>
                    ) : (
                      <>
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <span>{config.language === 'Bulgarian' ? 'Приключване' : 'Finish & Grade'}</span>
                      </>
                    )}
                </button>
             </div>
          </div>
        </div>

        {/* EXAM RESULT MODAL */}
        {examResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className={`h-2 w-full ${examResult.grade >= 5 ? 'bg-green-500' : examResult.grade >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                <div className="p-8 text-center">
                   
                   <div className={`
                      inline-flex items-center justify-center w-24 h-24 rounded-full border-4 mb-4 text-5xl font-bold
                      ${examResult.grade >= 5 ? 'border-green-500 text-green-500' : examResult.grade >= 3 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'}
                   `}>
                      {examResult.grade}
                   </div>
                   
                   <h2 className="text-2xl font-bold text-white mb-1">{examResult.label}</h2>
                   <div className="flex items-center justify-center gap-6 text-sm text-slate-400 mt-4 mb-6">
                      <div className="flex flex-col">
                        <span className="uppercase text-[10px] tracking-widest font-bold">Time</span>
                        <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="uppercase text-[10px] tracking-widest font-bold">Attempts</span>
                        <span className="text-white font-mono">{attempts}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="uppercase text-[10px] tracking-widest font-bold">Style</span>
                        <span className="text-white font-mono">{examResult.styleScore}%</span>
                      </div>
                   </div>

                   <div className="bg-slate-950 rounded-lg p-4 text-left border border-slate-800 max-h-48 overflow-y-auto">
                      <p className="text-sm text-slate-300 leading-relaxed">{examResult.feedback}</p>
                   </div>

                   <div className="mt-8 flex gap-3">
                      <button 
                        onClick={() => setExamResult(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-lg border border-slate-700 transition-colors"
                      >
                         {config.language === 'Bulgarian' ? 'Затвори' : 'Review Code'}
                      </button>
                      <button 
                        onClick={handleBackToSetup}
                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-orange-500/20 transition-colors"
                      >
                         {config.language === 'Bulgarian' ? 'Нов Тест' : 'New Exam'}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 font-sans selection:bg-orange-500/30 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-yellow-500 rounded flex items-center justify-center font-mono font-bold text-slate-900 text-lg">J</div>
             <span className="font-bold text-base tracking-tight text-slate-200">JavaMaster AI</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-red-500 text-white rounded-full shadow-xl flex items-center gap-3 animate-bounce">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">&times;</button>
          </div>
        )}

        {isGenerating ? (
          <div className="flex items-center justify-center h-full bg-slate-900">
            <Loading message={config.language === 'Bulgarian' ? "Генериране на задача..." : "Generating Challenge..."} />
          </div>
        ) : (
          !question ? renderSetup() : renderQuiz()
        )}
      </main>
    </div>
  );
}