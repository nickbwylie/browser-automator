import { supabase } from "@/supabaseClient"; // Keep if needed; unused here
import React, { useEffect, useState } from "react";

interface ScrapeField {
  selector: string;
  type: "text" | "attr" | "html";
  name: string;
  attr?: string;
  multiple?: boolean; // New: Extract array if true
}

export default function ScrapeTool() {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<ScrapeField[]>([]);
  const [script, setScript] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<Partial<ScrapeField>>({});
  const [selectedSelector, setSelectedSelector] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("Not started");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [lastExtractedText, setLastExtractedText] = useState("");

  const apiBase = "http://127.0.0.1:3003";

  const startRecording = async () => {
    try {
      const res = await fetch(`${apiBase}/start-recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        alert(
          "Browsers opened. Use the Codegen browser (with inspector) to record actions like clicks/navigation. Close it when done. Use the main browser to pick elements."
        );
        setRecordingStatus("Recording...");
        pollRecordingStatus();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const injectTool = async () => {
    try {
      const res = await fetch(`${apiBase}/inject-selector-tool`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.injected) {
        alert("Selector tool injected into main browser.");
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const openAddFieldModal = () => {
    setShowModal(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/get-selected`);
        const data = await res.json();
        if (data.selector) {
          setSelectedSelector(data.selector);
          setModalData((prev) => ({
            ...prev,
            selector: data.selector,
            type: data.text ? "text" : prev.type, // Auto-set to text if extracted text present
          }));
        }
        if (data.text) {
          setLastExtractedText(data.text); // Update dashboard preview
        }
      } catch {}
    }, 1000);
    setPollingInterval(interval);
  };

  const addField = () => {
    if (modalData.selector && modalData.name && modalData.type) {
      setFields([...fields, modalData as ScrapeField]);
      setShowModal(false);
      setModalData({});
      setSelectedSelector("");
      if (pollingInterval) clearInterval(pollingInterval);
    } else {
      alert("Fill all required fields.");
    }
  };

  const preview = async (field: ScrapeField) => {
    try {
      const res = await fetch(`${apiBase}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field),
      });
      const data = await res.json();
      alert(`Preview: ${JSON.stringify(data.result)}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const generate = async () => {
    try {
      await fetch(`${apiBase}/save-scrape-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const res = await fetch(`${apiBase}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, fields }), // Renamed steps to fields
      });
      const data = await res.json();
      if (data.script) {
        setScript(data.script);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const pollRecordingStatus = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/get-recording-status`);
        const data = await res.json();
        setRecordingStatus(data.status);
        if (data.ready) clearInterval(interval);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  };

  const stopSession = async () => {
    try {
      await fetch(`${apiBase}/stop-session`, { method: "POST" });
      setRecordingStatus("Stopped");
      alert("Session stopped.");
    } catch {}
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Visual Scrape Builder</h2>
      <p className="text-sm mb-2">
        Note: Respect site terms and robots.txt for ethical scraping.
      </p>

      <input
        className="border p-2 w-full mb-2"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter site URL"
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={startRecording}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Start Recording & Session
        </button>
        <button
          onClick={injectTool}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Inject Selector Tool
        </button>
        <button
          onClick={openAddFieldModal}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Add Field
        </button>
        <button
          onClick={generate}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Generate Script
        </button>
        <button
          onClick={stopSession}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Stop Session
        </button>
      </div>
      <p>Recording Status: {recordingStatus}</p>

      <ul className="mb-4">
        {fields.map((f, i) => (
          <li key={i}>
            <strong>{f.name}</strong> — <code>{f.selector}</code> [{f.type}]{" "}
            {f.multiple ? "(multiple)" : ""} {f.attr ? `attr=${f.attr}` : ""}
            <button
              onClick={() => preview(f)}
              className="ml-2 text-blue-500 underline"
            >
              Preview
            </button>
          </li>
        ))}
      </ul>

      {script && (
        <div>
          <h3 className="font-bold">Generated Script</h3>
          {/* <SyntaxHighlighter
            language="javascript"
            style={vscDarkPlus}
            className="overflow-auto text-sm"
          > */}
          {script}
          {/* </SyntaxHighlighter> */}
          <button
            onClick={() => navigator.clipboard.writeText(script)}
            className="mt-2 bg-gray-600 text-white px-2 py-1 rounded"
          >
            Copy Script
          </button>
        </div>
      )}

      {/* Add Field Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <h3 className="font-bold mb-2">Add Scrape Field</h3>
            <input
              className="border p-2 w-full mb-2"
              placeholder="Selector (auto-filled if picked)"
              value={modalData.selector || selectedSelector}
              onChange={(e) =>
                setModalData({ ...modalData, selector: e.target.value })
              }
            />
            <select
              className="border p-2 w-full mb-2"
              value={modalData.type || ""}
              onChange={(e) =>
                setModalData({ ...modalData, type: e.target.value as any })
              }
            >
              <option value="">Type</option>
              <option value="text">Text</option>
              <option value="html">HTML</option>
              <option value="attr">Attribute</option>
            </select>
            {modalData.type === "attr" && (
              <input
                className="border p-2 w-full mb-2"
                placeholder="Attribute name (e.g., href)"
                onChange={(e) =>
                  setModalData({ ...modalData, attr: e.target.value })
                }
              />
            )}
            <input
              className="border p-2 w-full mb-2"
              placeholder="Name (e.g., title)"
              onChange={(e) =>
                setModalData({ ...modalData, name: e.target.value })
              }
            />
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={modalData.multiple || false}
                onChange={(e) =>
                  setModalData({ ...modalData, multiple: e.target.checked })
                }
              />
              Extract multiple (array)
            </label>
            {lastExtractedText && modalData.type === "text" && (
              <div className="mb-2">
                <p className="font-bold">Preview of extracted text:</p>
                <pre className="bg-gray-100 p-2 overflow-auto text-sm max-h-32">
                  {lastExtractedText.slice(0, 200)}...
                </pre>
                <p className="text-sm">
                  This will be scraped via the selector in the script.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={addField}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  if (pollingInterval) clearInterval(pollingInterval);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
