import { stageMeta } from '../ruleTheme.js';

// v2で追加: ルール一覧をBefore→After形式のカードで表示する共通コンポーネント。
// 段階(A/B/C/D)ごとに色分けしたバッジを付ける。
// questionNumberを渡すと回答フェイズの解答用紙風（問題番号+丸チェック）になる。
export default function RuleCard({ rule, checked, onToggle, questionNumber, roundCheckbox }) {
  const meta = stageMeta(rule.stage);

  return (
    <label className={`rule-card${checked ? ' rule-card-checked' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className={roundCheckbox ? 'round-checkbox' : 'square-checkbox'}
      />
      <span className="rule-card-body">
        <span className="rule-card-top">
          {questionNumber != null && <span className="rule-card-qnum">問{questionNumber}</span>}
          <span
            className="rule-card-badge"
            style={{ background: meta.bg, color: meta.color }}
          >
            <i className={`ti ${meta.icon}`} aria-hidden="true" /> {meta.label}
          </span>
        </span>
        {rule.example && (
          <span className="rule-card-example">
            {rule.example.before} → {rule.example.after}
          </span>
        )}
        <span className="rule-card-label">{rule.label}</span>
        {rule.flavor && <span className="rule-card-flavor">{rule.flavor}</span>}
      </span>
    </label>
  );
}
