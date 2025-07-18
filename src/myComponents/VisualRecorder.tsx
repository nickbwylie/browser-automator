import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  RotateCcw,
  Copy,
  Download,
  MousePointer,
  Type,
  Eye,
  Navigation,
  Smartphone,
  Monitor,
  Tablet,
  Code,
  Settings,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface RecordedAction {
  id: string;
  type:
    | "navigate"
    | "click"
    | "type"
    | "wait"
    | "screenshot"
    | "scroll"
    | "hover"
    | "select";
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  description: string;
  xpath?: string;
  attributes?: Record<string, string>;
  screenshot?: string;
}

interface SelectorInfo {
  css: string;
  xpath: string;
  text?: string;
  attributes: Record<string, string>;
}

export default function VisualRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("https://example.com");
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [generatedScript, setGeneratedScript] = useState("");
  const [selectedElement, setSelectedElement] = useState<SelectorInfo | null>(
    null
  );
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [deviceType, setDeviceType] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  );
  const [isElementPickerActive, setIsElementPickerActive] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const recorderRef = useRef<any>(null);

  // Device presets
  const devicePresets = {
    desktop: { width: 1200, height: 800 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 },
  };

  useEffect(() => {
    setViewport(devicePresets[deviceType]);
  }, [deviceType]);

  // Initialize recorder when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const initializeRecorder = () => {
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentDocument;

        if (!iframeWindow || !iframeDocument) return;

        // Inject recorder script into iframe
        const script = iframeDocument.createElement("script");
        script.textContent = getRecorderScript();
        iframeDocument.head.appendChild(script);

        // Set up message listener
        iframeWindow.postMessage({ type: "INIT_RECORDER", isRecording }, "*");
      } catch (error) {
        console.warn("Cannot inject recorder script due to CORS restrictions");
      }
    };

    iframe.addEventListener("load", initializeRecorder);
    return () => iframe.removeEventListener("load", initializeRecorder);
  }, [isRecording]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "RECORDED_ACTION") {
        addAction(event.data.action);
      } else if (event.data.type === "ELEMENT_SELECTED") {
        setSelectedElement(event.data.selector);
        setIsElementPickerActive(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const getRecorderScript = () => {
    return `
      (function() {
        let isRecording = false;
        let isElementPicker = false;
        let recordedEvents = [];
        let elementOverlay = null;

        // Create element overlay for highlighting
        function createOverlay() {
          const overlay = document.createElement('div');
          overlay.style.cssText = \`
            position: absolute;
            border: 2px solid #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            pointer-events: none;
            z-index: 10000;
            display: none;
          \`;
          overlay.id = 'recorder-overlay';
          document.body.appendChild(overlay);
          return overlay;
        }

        // Generate CSS selector for element
        function generateSelector(element) {
          const selectors = [];
          
          // Try ID first
          if (element.id) {
            return '#' + element.id;
          }
          
          // Try data attributes
          for (const attr of element.attributes) {
            if (attr.name.startsWith('data-testid') || attr.name.startsWith('data-test')) {
              return \`[\${attr.name}="\${attr.value}"]\`;
            }
          }
          
          // Build path from classes and tags
          let current = element;
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            
            if (current.className && typeof current.className === 'string') {
              const classes = current.className.trim().split(/\\s+/).slice(0, 2);
              if (classes.length > 0 && !classes.some(c => c.match(/^(hover|focus|active|disabled)/))) {
                selector += '.' + classes.join('.');
              }
            }
            
            selectors.unshift(selector);
            current = current.parentElement;
          }
          
          return selectors.slice(-3).join(' > ');
        }

        // Generate XPath for element
        function generateXPath(element) {
          const parts = [];
          let current = element;
          
          while (current && current !== document) {
            let part = current.tagName.toLowerCase();
            const siblings = Array.from(current.parentNode?.children || [])
              .filter(el => el.tagName === current.tagName);
            
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              part += \`[\${index}]\`;
            }
            
            parts.unshift(part);
            current = current.parentElement;
          }
          
          return '//' + parts.join('/');
        }

        // Get element attributes
        function getElementAttributes(element) {
          const attrs = {};
          for (const attr of element.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        }

        // Record action
        function recordAction(type, element, value = '') {
          if (!isRecording) return;
          
          const selector = generateSelector(element);
          const xpath = generateXPath(element);
          const attributes = getElementAttributes(element);
          
          const action = {
            type,
            selector,
            xpath,
            value,
            attributes,
            description: \`\${type.charAt(0).toUpperCase() + type.slice(1)} on \${element.tagName.toLowerCase()}\`,
            elementText: element.textContent?.slice(0, 50) || ''
          };
          
          window.parent.postMessage({
            type: 'RECORDED_ACTION',
            action
          }, '*');
        }

        // Element highlighting
        function highlightElement(element) {
          if (!elementOverlay) {
            elementOverlay = createOverlay();
          }
          
          const rect = element.getBoundingClientRect();
          elementOverlay.style.cssText += \`
            display: block;
            left: \${rect.left + window.scrollX}px;
            top: \${rect.top + window.scrollY}px;
            width: \${rect.width}px;
            height: \${rect.height}px;
          \`;
        }

        function hideOverlay() {
          if (elementOverlay) {
            elementOverlay.style.display = 'none';
          }
        }

        // Event listeners
        document.addEventListener('click', (e) => {
          if (isElementPicker) {
            e.preventDefault();
            e.stopPropagation();
            
            const selector = generateSelector(e.target);
            const xpath = generateXPath(e.target);
            const attributes = getElementAttributes(e.target);
            
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              selector: {
                css: selector,
                xpath,
                attributes,
                text: e.target.textContent?.slice(0, 50)
              }
            }, '*');
            
            hideOverlay();
            return;
          }
          
          if (isRecording) {
            recordAction('click', e.target);
          }
        }, true);

        document.addEventListener('input', (e) => {
          if (isRecording && (e.target.matches('input, textarea, select'))) {
            recordAction('type', e.target, e.target.value);
          }
        });

        document.addEventListener('change', (e) => {
          if (isRecording && e.target.matches('select')) {
            recordAction('select', e.target, e.target.value);
          }
        });

        document.addEventListener('mouseover', (e) => {
          if (isElementPicker) {
            highlightElement(e.target);
          }
        });

        document.addEventListener('mouseout', () => {
          if (isElementPicker) {
            hideOverlay();
          }
        });

        // Listen for messages from parent
        window.addEventListener('message', (event) => {
          if (event.data.type === 'START_RECORDING') {
            isRecording = true;
            isElementPicker = false;
          } else if (event.data.type === 'STOP_RECORDING') {
            isRecording = false;
            isElementPicker = false;
            hideOverlay();
          } else if (event.data.type === 'START_ELEMENT_PICKER') {
            isElementPicker = true;
            isRecording = false;
            document.body.style.cursor = 'crosshair';
          } else if (event.data.type === 'STOP_ELEMENT_PICKER') {
            isElementPicker = false;
            document.body.style.cursor = '';
            hideOverlay();
          }
        });
      })();
    `;
  };

  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
    setActions([]);

    // Add initial navigation action
    const navigateAction: RecordedAction = {
      id: Date.now().toString(),
      type: "navigate",
      url: currentUrl,
      timestamp: Date.now(),
      description: `Navigate to ${currentUrl}`,
    };
    setActions([navigateAction]);

    // Send message to iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "START_RECORDING" },
        "*"
      );
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    generatePlaywrightScript();

    // Send message to iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "STOP_RECORDING" },
        "*"
      );
    }
  };

  const pauseRecording = () => {
    setIsPaused(!isPaused);
    const message = isPaused ? "START_RECORDING" : "STOP_RECORDING";
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: message }, "*");
    }
  };

  const resetRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setActions([]);
    setGeneratedScript("");
    setSelectedElement(null);

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "STOP_RECORDING" },
        "*"
      );
    }
  };

  const navigateToUrl = () => {
    if (iframeRef.current && currentUrl) {
      try {
        iframeRef.current.src = currentUrl;
        if (isRecording) {
          addAction({
            type: "navigate",
            url: currentUrl,
            description: `Navigate to ${currentUrl}`,
          });
        }
      } catch (error) {
        console.error("Navigation error:", error);
      }
    }
  };

  const addAction = (action: Omit<RecordedAction, "id" | "timestamp">) => {
    if (isRecording && !isPaused) {
      const newAction: RecordedAction = {
        ...action,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      setActions((prev) => [...prev, newAction]);
    }
  };

  const removeAction = (actionId: string) => {
    setActions((prev) => prev.filter((action) => action.id !== actionId));
  };

  const startElementPicker = () => {
    setIsElementPickerActive(true);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "START_ELEMENT_PICKER" },
        "*"
      );
    }
  };

  const stopElementPicker = () => {
    setIsElementPickerActive(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "STOP_ELEMENT_PICKER" },
        "*"
      );
    }
  };

  const generatePlaywrightScript = () => {
    let script = `async function automatedScript(page) {
  // Generated Playwright script from recorded actions
  // Device: ${deviceType} (${viewport.width}x${viewport.height})
  
  // Set viewport
  await page.setViewportSize({ width: ${viewport.width}, height: ${viewport.height} });
  
`;

    actions.forEach((action, index) => {
      script += `  // Step ${index + 1}: ${action.description}\n`;

      switch (action.type) {
        case "navigate":
          script += `  await page.goto('${action.url}');\n`;
          script += `  await page.waitForLoadState('networkidle');\n\n`;
          break;

        case "click":
          script += `  await page.waitForSelector('${action.selector}');\n`;
          script += `  await page.click('${action.selector}');\n\n`;
          break;

        case "type":
          script += `  await page.waitForSelector('${action.selector}');\n`;
          script += `  await page.fill('${action.selector}', '${action.value}');\n\n`;
          break;

        case "select":
          script += `  await page.waitForSelector('${action.selector}');\n`;
          script += `  await page.selectOption('${action.selector}', '${action.value}');\n\n`;
          break;

        case "hover":
          script += `  await page.waitForSelector('${action.selector}');\n`;
          script += `  await page.hover('${action.selector}');\n\n`;
          break;

        case "wait":
          script += `  await page.waitForSelector('${action.selector}');\n\n`;
          break;

        case "screenshot":
          script += `  await page.screenshot({ path: 'screenshot-step-${
            index + 1
          }.png', fullPage: true });\n\n`;
          break;

        case "scroll":
          script += `  await page.evaluate(() => window.scrollTo(0, ${
            action.value || 0
          }));\n\n`;
          break;
      }
    });

    script += `  // Take final screenshot\n`;
    script += `  await page.screenshot({ path: 'final-screenshot.png', fullPage: true });\n\n`;
    script += `  // Return data\n`;
    script += `  return {\n`;
    script += `    success: true,\n`;
    script += `    timestamp: new Date().toISOString(),\n`;
    script += `    stepsExecuted: ${actions.length},\n`;
    script += `    finalUrl: await page.url()\n`;
    script += `  };\n`;
    script += `}`;

    setGeneratedScript(script);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
  };

  const downloadScript = () => {
    const blob = new Blob([generatedScript], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playwright-script-${Date.now()}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    const exportData = {
      metadata: {
        created: new Date().toISOString(),
        device: deviceType,
        viewport,
        startUrl: currentUrl,
        totalActions: actions.length,
      },
      actions: actions.map((action) => ({
        ...action,
        relativeTime: action.timestamp - (actions[0]?.timestamp || 0),
      })),
      script: generatedScript,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (actions.length > 0) {
      generatePlaywrightScript();
    }
  }, [actions, viewport, deviceType]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case "navigate":
        return <Navigation className="w-4 h-4 text-purple-600" />;
      case "click":
        return <MousePointer className="w-4 h-4 text-blue-600" />;
      case "type":
        return <Type className="w-4 h-4 text-green-600" />;
      case "select":
        return <Type className="w-4 h-4 text-orange-600" />;
      case "hover":
        return <MousePointer className="w-4 h-4 text-yellow-600" />;
      case "wait":
        return <Eye className="w-4 h-4 text-gray-600" />;
      case "screenshot":
        return <span className="text-pink-600">📸</span>;
      case "scroll":
        return <span className="text-indigo-600">↕️</span>;
      default:
        return <Settings className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-screen max-h-screen p-4">
      {/* Left Panel - Browser Simulator */}
      <div className="xl:col-span-2 flex flex-col">
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-3 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Advanced Browser Recorder
              </CardTitle>

              {/* Device Selection */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={deviceType === "desktop" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDeviceType("desktop")}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceType === "tablet" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDeviceType("tablet")}
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceType === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDeviceType("mobile")}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* URL Bar */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter URL to navigate..."
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && navigateToUrl()}
                className="flex-1"
              />
              <Button onClick={navigateToUrl} variant="outline" size="sm">
                Go
              </Button>
            </div>

            {/* Recording Controls */}
            <div className="flex gap-2 flex-wrap">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <>
                  <Button onClick={stopRecording} variant="outline">
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                  <Button onClick={pauseRecording} variant="outline">
                    {isPaused ? (
                      <Play className="w-4 h-4 mr-2" />
                    ) : (
                      <span className="w-4 h-4 mr-2">⏸️</span>
                    )}
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                </>
              )}

              <Button onClick={resetRecording} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              <Button
                onClick={
                  isElementPickerActive ? stopElementPicker : startElementPicker
                }
                variant={isElementPickerActive ? "default" : "outline"}
                disabled={isRecording}
              >
                <MousePointer className="w-4 h-4 mr-2" />
                {isElementPickerActive ? "Stop Picker" : "Pick Element"}
              </Button>
            </div>

            {/* Status Indicators */}
            <div className="flex gap-4">
              {isRecording && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-800 font-medium">
                    {isPaused ? "Recording Paused" : "Recording Active"}
                  </span>
                </div>
              )}

              {isElementPickerActive && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <MousePointer className="w-3 h-3 text-blue-600" />
                  <span className="text-blue-800 font-medium">
                    Element Picker Active
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm">
                  {deviceType} ({viewport.width}×{viewport.height})
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-4">
            {/* Browser Window */}
            <div
              className="border border-gray-300 rounded-lg overflow-hidden shadow-lg mx-auto"
              style={{
                width: Math.min(viewport.width, 1000),
                height: Math.min(viewport.height, 600),
              }}
            >
              {/* Browser Header */}
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="bg-white px-3 py-1 rounded text-sm text-gray-600 flex-1 truncate">
                    {currentUrl}
                  </div>
                  {isRecording && (
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>

              {/* Iframe Container */}
              <div className="relative w-full h-full bg-white">
                <iframe
                  ref={iframeRef}
                  src={currentUrl}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
                  title="Browser Recorder"
                />

                {isElementPickerActive && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                      Click on any element to select it
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Element Info */}
            {selectedElement && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Selected Element</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <Label className="text-xs">CSS Selector:</Label>
                    <code className="block text-xs bg-gray-100 p-2 rounded mt-1">
                      {selectedElement.css}
                    </code>
                  </div>
                  <div>
                    <Label className="text-xs">XPath:</Label>
                    <code className="block text-xs bg-gray-100 p-2 rounded mt-1">
                      {selectedElement.xpath}
                    </code>
                  </div>
                  {selectedElement.text && (
                    <div>
                      <Label className="text-xs">Text Content:</Label>
                      <span className="block text-xs text-gray-600 mt-1">
                        "{selectedElement.text}"
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Actions and Script */}
      <div className="space-y-4 flex flex-col h-full">
        {/* Recorded Actions */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MousePointer className="w-5 h-5" />
                Actions ({actions.length})
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addAction({
                    type: "screenshot",
                    description: "Take screenshot",
                  })
                }
                disabled={!isRecording}
              >
                📸
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-full max-h-80">
              <div className="p-4 space-y-2">
                {actions.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No actions recorded yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Start recording to capture interactions
                    </p>
                  </div>
                ) : (
                  actions.map((action, index) => (
                    <div
                      key={action.id}
                      className="group flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getActionIcon(action.type)}
                          <Badge variant="secondary" className="text-xs">
                            {action.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 truncate">
                          {action.description}
                        </p>
                        {action.selector && (
                          <code className="text-xs text-gray-500 block truncate mt-1">
                            {action.selector}
                          </code>
                        )}
                        {action.value && (
                          <span className="text-xs text-blue-600 block truncate">
                            Value: "{action.value}"
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAction(action.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
                      >
                        ×
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Generated Script */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Generated Script
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyScript}
                  disabled={!generatedScript}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadScript}
                  disabled={!generatedScript}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportAsJSON}
                  disabled={!actions.length}
                >
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="h-full">
              {generatedScript ? (
                <ScrollArea className="h-full max-h-96">
                  <Textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    className="min-h-96 font-mono text-xs resize-none border-0 rounded-none"
                    placeholder="Generated Playwright script will appear here..."
                  />
                </ScrollArea>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Generated script will appear here</p>
                    <p className="text-sm text-gray-400 mt-1">
                      after recording actions
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
