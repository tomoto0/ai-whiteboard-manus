import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";


export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<"draw" | "erase">("draw");
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentSize, setCurrentSize] = useState(5);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [question, setQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const askAIMutation = trpc.whiteboard.askAI.useMutation();
  const generateIdeaMutation = trpc.whiteboard.generateIdea.useMutation();

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 70;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Initialize MathJax from CDN - only once
  useEffect(() => {
    // Check if MathJax is already loaded
    if ((window as any).MathJax) {
      return;
    }

    // Configure MathJax before loading the script
    (window as any).MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\(", "\\)"]],
        displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      },
      svg: {
        fontCache: "global",
      },
      startup: {
        pageReady: () => {
          return Promise.resolve();
        },
      },
    };

    const script = document.createElement("script");
    script.src = "https://polyfill.io/v3/polyfill.min.js?features=es6";
    document.head.appendChild(script);

    const mathJaxScript = document.createElement("script");
    mathJaxScript.id = "MathJax-script";
    mathJaxScript.async = true;
    mathJaxScript.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    document.head.appendChild(mathJaxScript);

    return () => {
      // Don't remove scripts on unmount to preserve MathJax state
    };
  }, []);

  // Render MathJax when aiResponse changes
  useEffect(() => {
    if (aiResponse && aiResponseRef.current) {
      // Use a small delay to ensure DOM is updated
      const renderMathJax = async () => {
        // Wait for DOM to be fully updated
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Now typeset the content
        const checkAndRender = () => {
          if ((window as any).MathJax && (window as any).MathJax.typesetPromise) {
            try {
              (window as any).MathJax.typesetPromise([aiResponseRef.current])
                .then(() => {
                  console.log("MathJax rendered successfully");
                })
                .catch((err: any) => {
                  console.log("MathJax error:", err);
                });
            } catch (e) {
              console.log("MathJax exception:", e);
            }
          } else {
            // Retry after a short delay
            setTimeout(checkAndRender, 100);
          }
        };
        checkAndRender();
      };

      renderMathJax();
    }
  }, [aiResponse]);

  // Drawing functions
  const getCanvasImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png").split(",")[1];
  };

  const isCanvasEmpty = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (!(pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255 && pixels[i + 3] === 255)) {
        return false;
      }
    }
    return true;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = currentSize;
    ctx.lineCap = "round";

    if (currentTool === "draw") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
    } else if (currentTool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) ctx.beginPath();
  };

  const handleClear = () => {
    if (!confirm("Are you sure you want to clear all drawings?")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleAskAI = async () => {
    if (!question.trim()) {
      alert("Please enter a question.");
      return;
    }

    setIsLoading(true);
    try {
      const imageData = isCanvasEmpty() ? undefined : getCanvasImage() || undefined;
      const result = await askAIMutation.mutateAsync({
        question,
        imageData,
      });
      setAiResponse(result.answer as string);
      setQuestion("");
    } catch (error) {
      setAiResponse("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateIdea = async () => {
    setIsLoading(true);
    try {
      const imageData = isCanvasEmpty() ? undefined : getCanvasImage() || undefined;
      const result = await generateIdeaMutation.mutateAsync({
        imageData,
      });
      setAiResponse(result.idea as string);
    } catch (error) {
      setAiResponse("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur border-b border-gray-200 p-3 z-50 flex items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
          <Button
            variant={currentTool === "draw" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentTool("draw")}
          >
            ✏️ Draw
          </Button>
          <Button
            variant={currentTool === "erase" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentTool("erase")}
          >
            🧽 Erase
          </Button>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-10 h-8 rounded cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="50"
            value={currentSize}
            onChange={(e) => setCurrentSize(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-600">{currentSize}px</span>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            🗑️ Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSave}>
            💾 Save
          </Button>
          <Button
            variant={showAIPanel ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowAIPanel(!showAIPanel)}
          >
            🤖 AI
          </Button>
        </div>

        <div className="ml-auto text-xl font-bold text-gray-800">AI Whiteboard</div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-16 left-0 cursor-crosshair bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {/* AI Panel */}
      {showAIPanel && (
        <Card className="fixed top-20 right-6 w-96 p-4 z-40 shadow-lg">
          <h3 className="text-lg font-bold mb-3">AI Assistant</h3>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your drawing or request ideas..."
            className="mb-3 h-20"
          />
          <div className="flex gap-2 mb-3">
            <Button
              onClick={handleAskAI}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Processing..." : "Ask AI"}
            </Button>
            <Button
              onClick={handleGenerateIdea}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? "Generating..." : "Generate Idea"}
            </Button>
          </div>
          {aiResponse && (
            <div
              ref={aiResponseRef}
              className="bg-gray-50 p-3 rounded border border-gray-200 max-h-96 overflow-y-auto text-sm whitespace-pre-wrap break-words"
            >
              {aiResponse}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

