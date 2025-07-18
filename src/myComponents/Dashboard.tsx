// ScrapeTool.tsx
import React, { useState } from "react";

interface ScrapeField {
  selector: string;
  type: "text" | "attr" | "html";
  name: string;
  attr?: string;
}

export default function ScrapeTool() {
  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<ScrapeField[]>([]);
  const [script, setScript] = useState("");

  const startSession = async () => {
    await fetch("http://127.0.0.1:3003/start-recording", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    alert("Browser opened");
  };

  const saveScrapeTargets = async () => {
    await fetch("http://127.0.0.1:3003/save-scrape-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields), // assuming fields is your list of { selector, name, type }
    });
  };

  const injectTool = async () => {
    await fetch("http://127.0.0.1:3003/inject-selector-tool", {
      method: "POST",
    });
    alert("Selector tool injected");
  };

  const addField = () => {
    const selector = prompt("Enter selector");
    const type = prompt("Type: text, html, or attr") as
      | "text"
      | "html"
      | "attr";
    const name = prompt("Name to use in code");
    const attr =
      type === "attr" ? prompt("Attribute name (e.g., href, src)") : undefined;

    if (selector && name && type) {
      setFields([...fields, { selector, type, name, attr }]);
    }
  };

  const preview = async (selector: string, type: string, attr?: string) => {
    const res = await fetch("http://127.0.0.1:3003/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selector, type, attr }),
    });
    const data = await res.json();
    alert(`Preview result: ${data.result}`);
  };

  const generate = async () => {
    await saveScrapeTargets();

    const res = await fetch("http://127.0.0.1:3003/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, steps: fields }),
    });
    const data = await res.json();
    setScript(data.script);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Visual Scrape Builder</h2>

      <input
        className="border p-2 w-full mb-2"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter site URL"
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={startSession}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Start Session
        </button>
        <button
          onClick={injectTool}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Inject Selector Tool
        </button>
        <button
          onClick={addField}
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
      </div>

      <ul className="mb-4">
        {fields.map((f, i) => (
          <li key={i}>
            <strong>{f.name}</strong> — <code>{f.selector}</code> [{f.type}]
            <button
              onClick={() => preview(f.selector, f.type, f.attr)}
              className="ml-2 text-blue-500 underline"
            >
              Preview
            </button>
          </li>
        ))}
      </ul>

      {script && (
        <pre className="bg-gray-100 p-4 overflow-auto text-sm">{script}</pre>
      )}
    </div>
  );
}
