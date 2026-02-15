import { useMemo, useRef, useCallback } from 'react';
import styles from './ComposeEditor.module.css';

const TEMPLATES = [
  {
    name: "Nginx + SSL",
    desc: "Reverse proxy with Let's Encrypt",
    stackName: "nginx-ssl",
    yaml: `services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./conf:/etc/nginx/conf.d
      - certs:/etc/letsencrypt
    restart: unless-stopped

volumes:
  certs:`,
  },
  {
    name: "Postgres + Redis",
    desc: "Database stack",
    stackName: "postgres-redis",
    yaml: `services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: changeme
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  pgdata:`,
  },
  {
    name: "Node.js App",
    desc: "Node with hot reload",
    stackName: "node-app",
    yaml: `services:
  app:
    image: node:20-slim
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
    working_dir: /app
    command: npm run dev
    restart: unless-stopped`,
  },
];

function parseServices(yaml) {
  const lines = yaml.split("\n");
  const services = [];
  let inServices = false;
  let currentService = null;
  let currentImage = "";
  let currentPorts = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === "services:") { inServices = true; return; }
    if (inServices && /^  \S/.test(line) && trimmed.endsWith(":")) {
      if (currentService) services.push({ name: currentService, image: currentImage, ports: currentPorts });
      currentService = trimmed.replace(":", "");
      currentImage = "";
      currentPorts = [];
    }
    if (currentService && trimmed.startsWith("image:")) currentImage = trimmed.replace("image:", "").trim();
    if (currentService && trimmed.startsWith("- \"") && trimmed.includes(":")) currentPorts.push(trimmed.replace(/^- "?|"?$/g, ""));
  });
  if (currentService) services.push({ name: currentService, image: currentImage, ports: currentPorts });
  return services;
}

export default function ComposeEditor({ stackName, onStackNameChange, yaml, onYamlChange, onDeploy, onCancel, deploying }) {
  const editorRef = useRef(null);
  const lineNumRef = useRef(null);

  const services = useMemo(() => parseServices(yaml), [yaml]);
  const lineCount = yaml.split("\n").length;

  const handleScroll = useCallback(() => {
    if (editorRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      onYamlChange(val.substring(0, start) + '  ' + val.substring(end));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [onYamlChange]);

  const handleTemplate = (tpl) => {
    onYamlChange(tpl.yaml);
    if (!stackName) onStackNameChange(tpl.stackName);
  };

  return (
    <div className={styles.editor}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>+ NEW STACK</span>
          <div className={styles.nameInput}>
            <span className={styles.nameLabel}>NAME:</span>
            <input
              className={styles.nameField}
              value={stackName}
              onChange={e => onStackNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-stack"
              spellCheck={false}
              autoFocus
            />
          </div>
          {stackName && <span className={styles.pathPreview}>~/stacks/{stackName}/compose.yaml</span>}
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.deployBtn}
            disabled={!stackName || deploying}
            onClick={onDeploy}
          >
            {deploying ? "DEPLOYING..." : "\u25B6 DEPLOY"}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* YAML editor */}
        <div className={styles.yamlPane}>
          <div className={styles.yamlHeader}>compose.yaml</div>
          <div className={styles.yamlEditor}>
            <div className={styles.lineNumbers} ref={lineNumRef}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className={styles.lineNum}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={editorRef}
              className={styles.textarea}
              value={yaml}
              onChange={e => onYamlChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>

        {/* Preview pane */}
        <div className={styles.previewPane}>
          <div className={styles.sectionLabel}>PREVIEW</div>
          {services.length === 0 ? (
            <div className={styles.emptyPreview}>Add services to compose.yaml to see preview</div>
          ) : (
            <>
              <div className={styles.serviceCount}>
                {services.length} service{services.length !== 1 ? "s" : ""} detected
              </div>
              {services.map((svc, i) => (
                <div key={i} className={styles.serviceCard}>
                  <div className={styles.serviceName}>&#x25CF; {svc.name}</div>
                  {svc.image && (
                    <div className={styles.serviceMeta}>
                      IMAGE: <span>{svc.image}</span>
                    </div>
                  )}
                  {svc.ports.length > 0 && (
                    <div className={`${styles.serviceMeta} ${styles.serviceMetaPorts}`} style={{ marginTop: 2 }}>
                      PORTS: <span>{svc.ports.join(", ")}</span>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Templates */}
          <div className={styles.templatesSection}>
            <div className={styles.sectionLabel}>TEMPLATES</div>
            {TEMPLATES.map((tpl, i) => (
              <div key={i} className={styles.templateCard} onClick={() => handleTemplate(tpl)}>
                <div className={styles.templateName}>{tpl.name}</div>
                <div className={styles.templateDesc}>{tpl.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
