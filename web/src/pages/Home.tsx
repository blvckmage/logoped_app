import { useNavigate } from 'react-router-dom';
import { Baby, Users, Stethoscope } from 'lucide-react';
import '../index.css';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-content">
        <header className="home-header">
          <h1>Сөйле ИИ</h1>
          <p>Добро пожаловать в платформу умной логопедии</p>
        </header>

        <div className="role-selection">
          <h2>Кто вы?</h2>
          <div className="role-cards">
            
            <div className="role-card child" onClick={() => navigate('/child')}>
              <div className="role-icon">
                <Baby size={48} />
              </div>
              <h3>Ребенок</h3>
              <p>Давай играть и тренировать звуки!</p>
            </div>

            <div className="role-card parent" onClick={() => navigate('/parent')}>
              <div className="role-icon">
                <Users size={48} />
              </div>
              <h3>Родитель</h3>
              <p>Посмотреть прогресс моего ребенка</p>
            </div>

            <div className="role-card therapist" onClick={() => navigate('/therapist')}>
              <div className="role-icon">
                <Stethoscope size={48} />
              </div>
              <h3>Логопед</h3>
              <p>Управление пациентами и заданиями</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
