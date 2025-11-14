import { useMemo, useState } from "react";
import "./App.css";

type Question = {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
};

const QUESTION_BANK: Question[] = [
  {
    id: 1,
    prompt: "Which statement sounds the most like your ideal day?",
    options: [
      "I run a perfectly scheduled routine.",
      "I improvise and see who I meet along the way.",
      "I listen closely, then make the room laugh.",
      "I lead a brainstorming session that sparks change."
    ],
    correctIndex: 1
  },
  {
    id: 2,
    prompt: "Choose the coffee order that best describes your vibe.",
    options: [
      "Double espresso — no nonsense.",
      "Seasonal latte — extra whipped cream.",
      "Iced coffee — even in the winter.",
      "Herbal tea — calm is power."
    ],
    correctIndex: 0
  },
  {
    id: 3,
    prompt: "You overhear a heated debate. What do you do?",
    options: [
      "Jump in with a hot take.",
      "Ask thoughtful questions.",
      "Live tweet the entire exchange.",
      "Diffuse the tension with a story."
    ],
    correctIndex: 2
  }
];

type SessionState = "idle" | "inRound" | "finished";

type StartScreenProps = {
  onStart: () => void;
};

type RoundViewProps = {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  score: number;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
  onSubmitRound: () => void;
  onEndSession: () => void;
};

type ResultsViewProps = {
  score: number;
  totalQuestions: number;
  onRestart: () => void;
};

const StartScreen = ({ onStart }: StartScreenProps) => (
  <div className="panel">
    <h1>Opinionated People</h1>
    <p className="subheading">Prototype build</p>
    <button className="primary" onClick={onStart}>
      Start Game
    </button>
  </div>
);

const RoundView = ({
  question,
  questionNumber,
  totalQuestions,
  score,
  selectedOption,
  onSelectOption,
  onSubmitRound,
  onEndSession
}: RoundViewProps) => (
  <div className="panel">
    <div className="round-status">
      <span>
        Round {questionNumber} / {totalQuestions}
      </span>
      <span>Score: {score}</span>
    </div>
    <h2>{question.prompt}</h2>
    <div className="options">
      {question.options.map((option, index) => (
        <button
          key={option}
          className={`option ${selectedOption === index ? "selected" : ""}`}
          onClick={() => onSelectOption(index)}
        >
          {option}
        </button>
      ))}
    </div>
    <div className="round-controls">
      <button className="primary" onClick={onSubmitRound} disabled={selectedOption === null}>
        {questionNumber === totalQuestions ? "See results" : "Lock it in"}
      </button>
      <button className="secondary" onClick={onEndSession}>
        End Session
      </button>
    </div>
  </div>
);

const ResultsView = ({ score, totalQuestions, onRestart }: ResultsViewProps) => (
  <div className="panel">
    <h2>Session complete</h2>
    <p>
      You scored {score} out of {totalQuestions}
    </p>
    <button className="primary" onClick={onRestart}>
      Restart
    </button>
  </div>
);

function App() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [rounds] = useState<Question[]>(QUESTION_BANK);

  const currentQuestion = useMemo(() => rounds[currentRound], [rounds, currentRound]);

  const resetSession = () => {
    setSessionState("idle");
    setCurrentRound(0);
    setScore(0);
    setSelectedOption(null);
  };

  const handleStart = () => {
    setScore(0);
    setCurrentRound(0);
    setSelectedOption(null);
    setSessionState("inRound");
  };

  const handleSelectOption = (index: number) => {
    setSelectedOption(index);
  };

  const handleSubmitRound = () => {
    if (selectedOption === null) return;

    if (selectedOption === currentQuestion.correctIndex) {
      setScore((prev) => prev + 1);
    }

    if (currentRound >= rounds.length - 1) {
      setSessionState("finished");
      setSelectedOption(null);
      return;
    }

    setCurrentRound((prev) => prev + 1);
    setSelectedOption(null);
  };

  const handleEndSession = () => {
    setSessionState("finished");
    setSelectedOption(null);
  };

  return (
    <div className="app-shell">
      {sessionState === "idle" && <StartScreen onStart={handleStart} />}
      {sessionState === "inRound" && currentQuestion && (
        <RoundView
          question={currentQuestion}
          questionNumber={currentRound + 1}
          totalQuestions={rounds.length}
          score={score}
          selectedOption={selectedOption}
          onSelectOption={handleSelectOption}
          onSubmitRound={handleSubmitRound}
          onEndSession={handleEndSession}
        />
      )}
      {sessionState === "finished" && (
        <ResultsView score={score} totalQuestions={rounds.length} onRestart={resetSession} />
      )}
    </div>
  );
}

export default App;
