import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type ComposerShellHandle = {
  getInput: () => string;
  setInput: Dispatch<SetStateAction<string>>;
  focus: () => void;
};

type Props = {
  /** Composer UI — receives isolated input state (keystrokes stay here). */
  children: (api: {
    input: string;
    setInput: Dispatch<SetStateAction<string>>;
  }) => ReactNode;
  /** Fired after every input change (refs / draft debounce), not for render. */
  onInputChange?: (input: string) => void;
  /** Reset input when the chat session changes. */
  sessionKey?: string;
};

/**
 * Owns composer `input` so typing does not re-render the parent transcript
 * (AIChatPanel). Parent reads/writes via the imperative handle on send,
 * draft restore, and starter prompts.
 */
export const ComposerShell = forwardRef<ComposerShellHandle, Props>(
  function ComposerShell({ children, onInputChange, sessionKey }, ref) {
    const [input, setInputState] = useState("");
    const inputRef = useRef(input);
    inputRef.current = input;
    const onChangeRef = useRef(onInputChange);
    onChangeRef.current = onInputChange;

    const setInput = useCallback((v: SetStateAction<string>) => {
      setInputState((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        inputRef.current = next;
        onChangeRef.current?.(next);
        return next;
      });
    }, []);

    useEffect(() => {
      setInputState("");
      inputRef.current = "";
      onChangeRef.current?.("");
    }, [sessionKey]);

    useImperativeHandle(
      ref,
      () => ({
        getInput: () => inputRef.current,
        setInput,
        focus: () => {
          const el = document.querySelector<HTMLTextAreaElement>(
            ".ai-composer-shell textarea.ai-input",
          );
          el?.focus();
        },
      }),
      [setInput],
    );

    return <>{children({ input, setInput })}</>;
  },
);
