import { v4 as uuidv4 } from "uuid";
import Markdown from "react-markdown";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CircleArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Artifact } from "@/types";
import { GraphInput } from "@/hooks/useGraph";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { convertToOpenAIFormat } from "@/lib/convert_messages";

export interface ArtifactRendererProps {
  artifact: Artifact | undefined;
  streamMessage: (input: GraphInput) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<BaseMessage[]>>;
  messages: BaseMessage[];
}

interface SelectionBox {
  top: number;
  left: number;
  text: string;
}

export function ArtifactRenderer(props: ArtifactRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      if (selectedText) {
        const rects = range.getClientRects();
        const firstRect = rects[0];
        const lastRect = rects[rects.length - 1];
        const contentRect = contentRef.current.getBoundingClientRect();

        const boxWidth = 400; // Approximate width of the selection box
        let left = lastRect.right - contentRect.left - boxWidth;

        // Ensure the box doesn't go beyond the left edge
        if (left < 0) {
          left = Math.min(0, firstRect.left - contentRect.left);
        }

        setSelectionBox({
          top: lastRect.bottom - contentRect.top,
          left: left,
          text: selectedText,
        });
        setIsInputVisible(false);
        setIsSelectionActive(true);
      }
    }
  }, []);

  const handleDocumentMouseDown = useCallback(
    (event: MouseEvent) => {
      if (
        isSelectionActive &&
        selectionBoxRef.current &&
        !selectionBoxRef.current.contains(event.target as Node)
      ) {
        setIsSelectionActive(false);
        setSelectionBox(null);
        setIsInputVisible(false);
      }
    },
    [isSelectionActive]
  );

  const handleSelectionBoxMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleSubmit = async () => {
    if (selectionBox && props.artifact) {
      const fullContent = props.artifact.content;
      const selectedText = selectionBox.text;

      const startIndex = fullContent.indexOf(selectedText);
      const endIndex = startIndex + selectedText.length;
      const humanMessage = new HumanMessage({
        content: inputValue,
        id: uuidv4(),
      });

      const currentConversation = [...props.messages, humanMessage];
      props.setMessages((prevMessages) => [...prevMessages, humanMessage]);

      await props.streamMessage({
        messages: currentConversation.map(convertToOpenAIFormat),
        highlighted: {
          id: props.artifact.id,
          startCharIndex: startIndex,
          endCharIndex: endIndex,
        },
      });
    }
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [handleMouseUp, handleDocumentMouseDown]);

  if (!props.artifact) {
    return null;
  }

  return (
    <div className="relative w-full h-full">
      <h1 className="text-xl font-bold absolute top-4 left-4">
        {props.artifact.title}
      </h1>
      <div ref={contentRef} className="flex justify-center h-full pt-[10%]">
        <div className="max-w-3xl w-full px-4">
          <Markdown className="text-left leading-relaxed">
            {props.artifact.content}
          </Markdown>
        </div>
        {selectionBox && isSelectionActive && (
          <div
            ref={selectionBoxRef}
            className={cn(
              "absolute bg-white border border-gray-200 shadow-md p-2 flex gap-2",
              isInputVisible ? "rounded-3xl" : "rounded-md"
            )}
            style={{
              top: `${selectionBox.top + 10}px`,
              left: `${selectionBox.left}px`,
              width: isInputVisible ? "400px" : "250px",
              marginLeft: isInputVisible ? "0" : "150px",
            }}
            onMouseDown={handleSelectionBoxMouseDown}
          >
            {isInputVisible ? (
              <div className="relative w-full overflow-hidden flex flex-row items-center gap-1">
                <Input
                  className="w-full transition-all duration-300 focus:ring-0 ease-in-out p-1 focus:outline-none border-0 focus-visible:ring-0"
                  placeholder="Ask Open Canvas..."
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <CircleArrowUp
                  className="cursor-pointer"
                  onClick={handleSubmit}
                  fill="black"
                  stroke="white"
                  size={30}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setIsInputVisible(true)}
                className="transition-all duration-300 ease-in-out w-full"
              >
                Ask Open Canvas
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}