import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import '../index.css';

// Mock Data
const MOCK_STATS = {
  childName: "Амина",
  totalMinutes: 45,
  completedTasks: 12,
  problemSounds: ["Р", "Ш"]
};

const MOCK_HISTORY = [
  { id: 1, date: "Сегодня, 14:30", word: "Рама", result: "Ошибка (Ротацизм)", status: "error" },
  { id: 2, date: "Сегодня, 14:28", word: "Қала", result: "Отлично", status: "success" },
  { id: 3, date: "Вчера, 18:15", word: "Рама", result: "Искажение", status: "error" },
  { id: 4, date: "Вчера, 18:10", word: "Лампа", result: "Отлично", status: "success" }
];

function ParentDashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">
      <button className="back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={24} /> Назад
      </button>

      <header className="dashboard-header">
        <h1>Кабинет Родителя</h1>
        <p>Статистика ребенка: <strong>{MOCK_STATS.childName}</strong></p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <Clock className="stat-icon" size={32} color="#4ECDC4" />
          <div className="stat-info">
            <h4>Время занятий</h4>
            <h2>{MOCK_STATS.totalMinutes} мин</h2>
          </div>
        </div>

        <div className="stat-card">
          <CheckCircle className="stat-icon" size={32} color="#2ed573" />
          <div className="stat-info">
            <h4>Пройдено слов</h4>
            <h2>{MOCK_STATS.completedTasks}</h2>
          </div>
        </div>

        <div className="stat-card">
          <AlertTriangle className="stat-icon" size={32} color="#ffa502" />
          <div className="stat-info">
            <h4>Трудные звуки</h4>
            <h2>{MOCK_STATS.problemSounds.join(", ")}</h2>
          </div>
        </div>
      </div>

      <section className="history-section">
        <h3>Последние попытки</h3>
        <div className="history-list">
          {MOCK_HISTORY.map(item => (
            <div key={item.id} className={`history-item ${item.status}`}>
              <div className="history-details">
                <span className="history-word">{item.word}</span>
                <span className="history-date">{item.date}</span>
              </div>
              <div className="history-result">
                {item.result}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ParentDashboard;
