import { useState } from "react";
import type { Answer } from "../../schemas/common";
import type { Question } from "../../schemas/service.schema";

type Props = {
  question: Question;
  answer?: Answer;
  error?: string;
  onChange: (answer: Answer | undefined) => void;
};

export function QuestionField({ question, answer, error, onChange }: Props) {
  const { id, type, options = [] } = question;
  const description = [question.description && id + "-description", error && id + "-error"]
    .filter(Boolean)
    .join(" ");
  const inputProps = { "aria-describedby": description || undefined, "aria-invalid": Boolean(error) };
  const [numberText, setNumberText] = useState(() => (typeof answer === "number" ? String(answer) : ""));

  const choices =
    type === "boolean"
      ? [
          { id: "yes", label: "是", value: true },
          { id: "no", label: "否", value: false },
        ]
      : options;

  return (
    <fieldset className="question-fields">
      <legend className="sr-only">
        {question.title}
        {question.required ? "（必答）" : "（选填）"}
      </legend>
      {question.description && (
        <p id={id + "-description"} className="muted">
          {question.description}
        </p>
      )}
      {type === "select" ? (
        <select
          {...inputProps}
          aria-label={question.title}
          aria-required={question.required}
          value={options.findIndex((option) => option.value === answer)}
          onChange={(event) => onChange(options[Number(event.target.value)]?.value)}
        >
          <option value="-1">请选择</option>
          {options.map((option, index) => (
            <option key={option.id} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      ) : choices.length > 0 ? (
        <div className="choices">
          {choices.map((option) => {
            const multiple = type === "multiple";
            const selected = Array.isArray(answer) ? answer : [];
            return (
              <label className="choice" key={option.id}>
                <input
                  {...inputProps}
                  name={id}
                  type={multiple ? "checkbox" : "radio"}
                  checked={multiple ? selected.includes(option.value) : answer === option.value}
                  onChange={(event) => {
                    if (!multiple) onChange(option.value);
                    else {
                      const values = event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((value) => value !== option.value);
                      onChange(values.length ? values : undefined);
                    }
                  }}
                />
                <span>
                  {option.label}
                  {"description" in option && option.description && <small>{option.description}</small>}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="quantity-control">
          <input
            {...inputProps}
            aria-label={question.title}
            aria-required={question.required}
            type="number"
            inputMode={question.validation?.integer ? "numeric" : "decimal"}
            min={question.validation?.min ?? (type === "number" ? undefined : 0)}
            max={question.validation?.max}
            step={question.validation?.integer ? 1 : "any"}
            value={numberText}
            onChange={(event) => {
              const input = event.currentTarget;
              setNumberText(input.value);
              onChange(input.value || input.validity.badInput ? input.valueAsNumber : undefined);
            }}
          />
          {type === "area" && <span>平方米</span>}
          {type === "distance" && <span>公里</span>}
        </div>
      )}
      {error && (
        <p id={id + "-error"} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
