import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, PlusCircle, Activity } from 'lucide-react';
import '../index.css';

// Mock Data
const MOCK_PATIENTS = [
  { id: 1, name: "Амина", age: 5, lastActive: "Сегодня", progress: "Средний", problemSounds: ["Р", "Ш"] },
  { id: 2, name: "Тимур", age: 6, lastActive: "Вчера", progress: "Хороший", problemSounds: ["Л"] },
  { id: 3, name: "Айша", age: 4, lastActive: "3 дня назад", progress: "Начальный", problemSounds: ["Қ", "Ғ"] },
];

function TherapistDashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container therapist-dashboard">
      <div className="dashboard-header-flex">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} /> Назад
        </button>
        <button className="primary-btn">
          <PlusCircle size={20} /> Добавить ученика
        </button>
      </div>

      <header className="dashboard-header left-align">
        <h1>Кабинет Логопеда</h1>
        <p>Управление пациентами и назначениями</p>
      </header>

      <section className="patients-section">
        <div className="section-header">
          <h3><Users size={20} /> Мои ученики ({MOCK_PATIENTS.length})</h3>
        </div>
        
        <div className="table-responsive">
          <table className="patients-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Возраст</th>
                <th>Трудные звуки</th>
                <th>Активность</th>
                <th>Прогресс</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PATIENTS.map(patient => (
                <tr key={patient.id}>
                  <td className="patient-name">{patient.name}</td>
                  <td>{patient.age} лет</td>
                  <td>
                    <div className="tags">
                      {patient.problemSounds.map(s => <span key={s} className="tag">{s}</span>)}
                    </div>
                  </td>
                  <td>{patient.lastActive}</td>
                  <td>
                    <span className={`progress-badge ${patient.progress === 'Хороший' ? 'success' : patient.progress === 'Средний' ? 'warning' : 'neutral'}`}>
                      {patient.progress}
                    </span>
                  </td>
                  <td>
                    <button className="icon-btn" title="Посмотреть аналитику">
                      <Activity size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default TherapistDashboard;
