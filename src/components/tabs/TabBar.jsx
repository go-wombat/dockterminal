import styles from './TabBar.module.css';

export default function TabBar({ tabs, activeTab, onTabChange, faultCount }) {
  return (
    <div className={styles.bar}>
      {tabs.map(tab => (
        <div
          key={tab}
          onClick={() => onTabChange(tab)}
          className={activeTab === tab ? styles.tabActive : styles.tab}
          onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = '#00cc38'; }}
          onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = ''; }}
        >
          {tab === "AI AGENT" && faultCount > 0 && <span className={styles.warn}>⚠</span>}
          {tab}
        </div>
      ))}
    </div>
  );
}
