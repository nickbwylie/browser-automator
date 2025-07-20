import { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Pause,
  MousePointer,
  Type,
  Download,
  Trash2,
  Zap,
  Code,
  Copy,
  Globe,
  Camera,
  Plus,
  AlertCircle,
  CheckCircle,
  Monitor,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import io, { Socket } from "socket.io-client";

// Types
interface Action {
  id: string;
  type: "navigation" | "click" | "input" | "submit" | "hover";
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  description: string;
}

interface ExtractionField {
  id: string;
  name: string;
  selector: string;
  type: "text" | "html" | "attr";
  attribute?: string;
  preview?: string;
}

interface SessionState {
  sessionId: string | null;
  status: "idle" | "recording" | "paused" | "running";
  isConnected: boolean;
  currentUrl: string;
  actions: Action[];
  extractionFields: ExtractionField[];
}

const BACKEND_URL = "http://localhost:3001";

export default function BrowserAutomation() {
  // State
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    status: "idle",
    isConnected: false,
    currentUrl: "https://example.com",
    actions: [],
    extractionFields: [],
  });

  const [userId] = useState(`user_${Date.now()}`); // Simple user ID for demo
  const [generatedScript, setGeneratedScript] = useState("");
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [isElementPickerActive, setIsElementPickerActive] = useState(false);
  const [activeTab, setActiveTab] = useState("recording");

  const socketRef = useRef<Socket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to backend");
      setSessionState((prev) => ({ ...prev, isConnected: true }));
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from backend");
      setSessionState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on("session_state", (data) => {
      console.log("Session state received:", data);
      setSessionState((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        status: data.status,
        currentUrl: data.currentUrl,
        actions: data.actions || [],
      }));
    });

    socket.on("action_recorded", (action) => {
      console.log("New action recorded:", action);
      setSessionState((prev) => ({
        ...prev,
        actions: [...prev.actions, action],
      }));
    });

    socket.on("navigation_completed", (data) => {
      console.log("Navigation completed:", data.url);
      setSessionState((prev) => ({ ...prev, currentUrl: data.url }));
    });

    socket.on("recording_status", (data) => {
      console.log("Recording status:", data.recording);
      setSessionState((prev) => ({
        ...prev,
        status: data.recording ? "recording" : "idle",
      }));
    });

    socket.on("element_selected", (elementInfo) => {
      console.log("Element selected:", elementInfo);
      setSelectedElement(elementInfo);
      setIsElementPickerActive(false);
    });

    socket.on("element_picker_active", (data) => {
      setIsElementPickerActive(data.active);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      alert(`Error: ${error.message}`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Session management
  const startSession = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          startUrl: sessionState.currentUrl,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Session started:", data.sessionId);

        // Join the session via WebSocket
        socketRef.current?.emit("join_session", {
          sessionId: data.sessionId,
          userId,
        });

        setSessionState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          status: "idle",
        }));
      } else {
        alert(`Failed to start session: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session");
    }
  };

  const stopSession = async () => {
    if (!sessionState.sessionId) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionState.sessionId}/stop`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        setSessionState((prev) => ({
          ...prev,
          sessionId: null,
          status: "idle",
          actions: [],
          extractionFields: [],
        }));
        setGeneratedScript("");
      }
    } catch (error) {
      console.error("Failed to stop session:", error);
    }
  };

  const toggleRecording = () => {
    if (!sessionState.sessionId) return;

    const newRecordingState = sessionState.status !== "recording";

    socketRef.current?.emit("toggle_recording", {
      sessionId: sessionState.sessionId,
      recording: newRecordingState,
    });
  };

  const navigateToUrl = () => {
    if (!sessionState.sessionId) return;

    socketRef.current?.emit("navigate", {
      sessionId: sessionState.sessionId,
      url: sessionState.currentUrl,
    });
  };

  const startElementPicker = () => {
    if (!sessionState.sessionId) return;

    socketRef.current?.emit("start_element_picker", {
      sessionId: sessionState.sessionId,
    });
    setIsElementPickerActive(true);
  };

  // Extraction field management
  const addExtractionField = () => {
    const newField: ExtractionField = {
      id: Date.now().toString(),
      name: "new_field",
      selector: selectedElement?.selector || "",
      type: "text",
      preview: "",
    };

    setSessionState((prev) => ({
      ...prev,
      extractionFields: [...prev.extractionFields, newField],
    }));
  };

  const updateExtractionField = (
    id: string,
    updates: Partial<ExtractionField>
  ) => {
    setSessionState((prev) => ({
      ...prev,
      extractionFields: prev.extractionFields.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      ),
    }));
  };

  const removeExtractionField = (id: string) => {
    setSessionState((prev) => ({
      ...prev,
      extractionFields: prev.extractionFields.filter(
        (field) => field.id !== id
      ),
    }));
  };

  const generateScript = async () => {
    if (!sessionState.sessionId) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionState.sessionId}/generate-script`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGeneratedScript(data.script);
        setActiveTab("script");
      } else {
        alert(`Failed to generate script: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to generate script:", error);
      alert("Failed to generate script");
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    alert("Script copied to clipboard!");
  };

  const getStatusColor = () => {
    switch (sessionState.status) {
      case "recording":
        return "bg-red-500";
      case "paused":
        return "bg-yellow-500";
      case "running":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "navigation":
        return <Globe className="w-4 h-4 text-purple-600" />;
      case "click":
        return <MousePointer className="w-4 h-4 text-blue-600" />;
      case "input":
        return <Type className="w-4 h-4 text-green-600" />;
      case "submit":
        return <Zap className="w-4 h-4 text-orange-600" />;
      default:
        return <Settings className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              Browser Automation Studio
            </h1>

            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  sessionState.isConnected ? "bg-green-500" : "bg-red-500"
                } animate-pulse`}
              ></div>
              <span className="text-sm text-gray-600">
                {sessionState.isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Session status */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
              <span className="text-sm font-medium capitalize">
                {sessionState.status}
              </span>
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-2">
            {!sessionState.sessionId ? (
              <Button
                onClick={startSession}
                className="bg-red-600 hover:bg-red-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Session
              </Button>
            ) : (
              <>
                <Button onClick={toggleRecording} variant="outline">
                  {sessionState.status === "recording" ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Record
                    </>
                  )}
                </Button>
                <Button onClick={stopSession} variant="outline">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button
                  onClick={generateScript}
                  disabled={sessionState.actions.length === 0}
                >
                  <Code className="w-4 h-4 mr-2" />
                  Generate Script
                </Button>
              </>
            )}
          </div>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2">
          <Label
            htmlFor="url"
            className="text-sm font-medium whitespace-nowrap"
          >
            URL:
          </Label>
          <Input
            id="url"
            value={sessionState.currentUrl}
            onChange={(e) =>
              setSessionState((prev) => ({
                ...prev,
                currentUrl: e.target.value,
              }))
            }
            placeholder="Enter website URL..."
            className="flex-1"
          />
          <Button
            onClick={navigateToUrl}
            variant="outline"
            size="sm"
            disabled={!sessionState.sessionId}
          >
            <Globe className="w-4 h-4 mr-2" />
            Navigate
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <TabsList className="grid w-full grid-cols-3 m-4">
              <TabsTrigger value="recording">Recording</TabsTrigger>
              <TabsTrigger value="extraction">Extraction</TabsTrigger>
              <TabsTrigger value="script">Script</TabsTrigger>
            </TabsList>

            {/* Recording Tab */}
            <TabsContent value="recording" className="flex-1 px-4">
              <div className="space-y-4">
                {/* Quick actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      onClick={startElementPicker}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={
                        !sessionState.sessionId || isElementPickerActive
                      }
                    >
                      <MousePointer className="w-4 h-4 mr-2" />
                      {isElementPickerActive
                        ? "Picking Element..."
                        : "Element Picker"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Screenshot
                    </Button>
                  </CardContent>
                </Card>

                {/* Recorded actions */}
                <Card className="flex-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Actions ({sessionState.actions.length})
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSessionState((prev) => ({ ...prev, actions: [] }))
                        }
                        disabled={sessionState.actions.length === 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-64">
                      <div className="p-4 space-y-2">
                        {sessionState.actions.length === 0 ? (
                          <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500">
                              No actions recorded yet
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Start recording to capture interactions
                            </p>
                          </div>
                        ) : (
                          sessionState.actions.map((action, index) => (
                            <div
                              key={action.id}
                              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                            >
                              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getActionIcon(action.type)}
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {action.type}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {action.description}
                                </p>
                                {action.selector && (
                                  <code className="text-xs text-gray-500 block truncate">
                                    {action.selector}
                                  </code>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Extraction Tab */}
            <TabsContent value="extraction" className="flex-1 px-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Data Fields</h3>
                  <Button
                    onClick={addExtractionField}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field
                  </Button>
                </div>

                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {sessionState.extractionFields.map((field) => (
                      <Card key={field.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Input
                              value={field.name}
                              onChange={(e) =>
                                updateExtractionField(field.id, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Field name"
                              className="flex-1 text-sm"
                            />
                            <Button
                              onClick={() => removeExtractionField(field.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>

                          <Input
                            value={field.selector}
                            onChange={(e) =>
                              updateExtractionField(field.id, {
                                selector: e.target.value,
                              })
                            }
                            placeholder="CSS selector"
                            className="text-sm font-mono"
                          />

                          <div className="flex gap-2">
                            <Select
                              value={field.type}
                              onValueChange={(
                                value: "text" | "html" | "attr"
                              ) =>
                                updateExtractionField(field.id, { type: value })
                              }
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="html">HTML</SelectItem>
                                <SelectItem value="attr">Attribute</SelectItem>
                              </SelectContent>
                            </Select>

                            {field.type === "attr" && (
                              <Input
                                value={field.attribute || ""}
                                onChange={(e) =>
                                  updateExtractionField(field.id, {
                                    attribute: e.target.value,
                                  })
                                }
                                placeholder="attr name"
                                className="flex-1 text-sm"
                              />
                            )}
                          </div>

                          {field.preview && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                              Preview: {field.preview}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Script Tab */}
            <TabsContent value="script" className="flex-1 px-4">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Generated Script</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={copyScript}
                      variant="outline"
                      size="sm"
                      disabled={!generatedScript}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!generatedScript}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-auto">
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                    {generatedScript ||
                      '// Generated script will appear here...\n// Record some actions and click "Generate Script"'}
                  </pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col bg-gray-100">
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-2xl mx-4">
              <CardContent className="p-8 text-center">
                <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl font-semibold mb-2">Browser Window</h2>
                <p className="text-gray-600 mb-6">
                  {!sessionState.sessionId
                    ? 'Click "Start Session" to launch the browser and begin recording'
                    : sessionState.status === "recording"
                    ? "Browser is open and recording your actions. Switch to the browser window to interact with websites."
                    : 'Browser is open but not recording. Click "Record" to start capturing interactions.'}
                </p>

                {sessionState.sessionId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Browser Session Active
                      </span>
                    </div>
                    <p className="text-xs text-blue-600">
                      Current URL: {sessionState.currentUrl}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right sidebar - Selected element info */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium">Element Inspector</h3>
          </div>

          <div className="flex-1 p-4">
            {selectedElement ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Selected Element</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <Label className="text-xs text-gray-600">Tag:</Label>
                    <p className="text-sm font-mono">
                      {selectedElement.tagName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Selector:</Label>
                    <code className="block text-xs bg-gray-50 p-1 rounded mt-1">
                      {selectedElement.selector}
                    </code>
                  </div>
                  {selectedElement.text && (
                    <div>
                      <Label className="text-xs text-gray-600">Text:</Label>
                      <p className="text-sm mt-1">"{selectedElement.text}"</p>
                    </div>
                  )}
                  <Button
                    onClick={addExtractionField}
                    size="sm"
                    className="w-full mt-2"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add as Field
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8">
                <MousePointer className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No element selected</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use the element picker to select elements
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
