import { useState, useMemo, useRef, useCallback } from 'react';
import styles from './ComposeEditor.module.css';
import ComposeGraph from './ComposeGraph';

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

function parseCompose(yaml) {
  const lines = yaml.split("\n");
  const services = [];
  const networks = [];
  let topLevel = null; // "services" | "networks" | "volumes" | null
  let currentService = null;
  let currentProp = null; // "ports" | "depends_on" | "networks" | "volumes" | "environment"
  let svc = null;

  const pushService = () => {
    if (svc) services.push(svc);
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    // Detect top-level sections (no indent)
    if (/^\S/.test(line) && trimmed.endsWith(":")) {
      pushService();
      currentService = null;
      svc = null;
      currentProp = null;
      const section = trimmed.replace(":", "");
      if (section === "services" || section === "networks" || section === "volumes") {
        topLevel = section;
      } else {
        topLevel = null;
      }
      return;
    }

    // Top-level networks section — collect network names
    if (topLevel === "networks" && /^  \S/.test(line) && trimmed.endsWith(":")) {
      networks.push(trimmed.replace(":", ""));
      return;
    }

    // Inside services section
    if (topLevel === "services") {
      // Service name (2-space indent, ends with colon)
      if (/^  \S/.test(line) && trimmed.endsWith(":")) {
        pushService();
        currentService = trimmed.replace(":", "");
        svc = { name: currentService, image: "", status: "created", ports: [], depends_on: [], networks: [], volumes: [], env: {} };
        currentProp = null;
        return;
      }

      if (!svc) return;

      // Service-level properties (4-space indent)
      if (/^    \S/.test(line) && !trimmed.startsWith("-")) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx === -1) return;
        const key = trimmed.substring(0, colonIdx).trim();
        const val = trimmed.substring(colonIdx + 1).trim();

        if (key === "image") { svc.image = val; currentProp = null; return; }
        if (key === "ports") { currentProp = "ports"; return; }
        if (key === "depends_on") { currentProp = "depends_on"; return; }
        if (key === "networks") { currentProp = "networks"; return; }
        if (key === "volumes") { currentProp = "volumes"; return; }
        if (key === "environment") { currentProp = "environment"; return; }

        // Other properties — reset current list context
        currentProp = null;
        return;
      }

      // List items (6-space indent, starts with "- ")
      if (trimmed.startsWith("- ") && currentProp) {
        const val = trimmed.substring(2).replace(/^["']|["']$/g, "");
        if (currentProp === "ports") svc.ports.push(val);
        else if (currentProp === "depends_on") svc.depends_on.push(val);
        else if (currentProp === "networks") svc.networks.push(val);
        else if (currentProp === "volumes") svc.volumes.push(val);
        return;
      }

      // Map items under environment (6-space indent, KEY: value)
      if (currentProp === "environment" && /^      \S/.test(line)) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
          const k = trimmed.substring(0, colonIdx).trim();
          const v = trimmed.substring(colonIdx + 1).trim();
          svc.env[k] = v;
        }
        return;
      }
    }
  });

  pushService();
  return { services, networks };
}

export default function ComposeEditor({ stackName, onStackNameChange, yaml, onYamlChange, env = '', onEnvChange, onDeploy, onCancel, deploying, editMode = false }) {
  const [activeEditorTab, setActiveEditorTab] = useState('compose');
  const editorRef = useRef(null);
  const lineNumRef = useRef(null);
  const envEditorRef = useRef(null);
  const envLineNumRef = useRef(null);

  const parsed = useMemo(() => parseCompose(yaml), [yaml]);
  const lineCount = yaml.split("\n").length;
  const envLineCount = Math.max((env || '').split("\n").length, 1);

  const handleScroll = useCallback(() => {
    if (editorRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, []);

  const handleEnvScroll = useCallback(() => {
    if (envEditorRef.current && envLineNumRef.current) {
      envLineNumRef.current.scrollTop = envEditorRef.current.scrollTop;
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
          <span className={styles.title}>{editMode ? "✎ EDIT STACK" : "+ NEW STACK"}</span>
          <div className={styles.nameInput}>
            <span className={styles.nameLabel}>NAME:</span>
            <input
              className={styles.nameField}
              value={stackName}
              onChange={e => onStackNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-stack"
              spellCheck={false}
              autoFocus={!editMode}
              disabled={editMode}
              style={editMode ? { opacity: 0.5 } : undefined}
            />
          </div>
          {stackName && <span className={styles.pathPreview}>~/stacks/{stackName}/{activeEditorTab === 'env' ? '.env' : 'compose.yaml'}</span>}
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.deployBtn}
            disabled={!stackName || deploying}
            onClick={onDeploy}
          >
            {deploying ? "SAVING..." : editMode ? "SAVE & RESTART" : "\u25B6 DEPLOY"}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={activeEditorTab === 'compose' ? styles.tabActive : styles.tab}
          onClick={() => setActiveEditorTab('compose')}
        >COMPOSE</button>
        <button
          className={activeEditorTab === 'env' ? styles.tabActive : styles.tab}
          onClick={() => setActiveEditorTab('env')}
        >ENV</button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Editor pane */}
        <div className={styles.yamlPane}>
          {activeEditorTab === 'compose' ? (
            <>
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
            </>
          ) : (
            <>
              <div className={styles.yamlHeader}>.env</div>
              <div className={styles.yamlEditor}>
                <div className={styles.lineNumbers} ref={envLineNumRef}>
                  {Array.from({ length: envLineCount }, (_, i) => (
                    <div key={i} className={styles.lineNum}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={envEditorRef}
                  className={styles.textarea}
                  value={env}
                  onChange={e => onEnvChange(e.target.value)}
                  onScroll={handleEnvScroll}
                  spellCheck={false}
                  wrap="off"
                  placeholder="KEY=value"
                />
              </div>
            </>
          )}
        </div>

        {/* Preview pane */}
        <div className={styles.previewPane}>
          <div className={styles.sectionLabel}>
            PREVIEW
            {parsed.services.length > 0 && (
              <span className={styles.serviceCount}>
                {" \u2014 "}{parsed.services.length} service{parsed.services.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className={styles.graphContainer}>
            <ComposeGraph services={parsed.services} networks={parsed.networks} />
          </div>

          {/* Templates (hidden in edit mode) */}
          {!editMode && (
            <div className={styles.templatesSection}>
              <div className={styles.sectionLabel}>TEMPLATES</div>
              {TEMPLATES.map((tpl, i) => (
                <div key={i} className={styles.templateCard} onClick={() => handleTemplate(tpl)}>
                  <div className={styles.templateName}>{tpl.name}</div>
                  <div className={styles.templateDesc}>{tpl.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
