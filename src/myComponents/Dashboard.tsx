import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
// import { Editor } from "@monaco-editor/react"; // Assuming you have Monaco set up
import axios from "axios";
import { supabase } from "../supabaseClient";

export default function Dashboard() {
  const [scripts, setScripts] = useState([]);
  const [selectedScripts, setSelectedScripts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptCode, setNewScriptCode] = useState(
    "// Your Playwright script here"
  );
  const [editingScript, setEditingScript] = useState(null);

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (session) {
      const token = session.session?.access_token;
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/scripts`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setScripts(response.data);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedScripts([...selectedScripts, id]);
    } else {
      setSelectedScripts(
        selectedScripts.filter((selectedId) => selectedId !== id)
      );
    }
  };

  const handleRunSelected = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (session) {
      const token = session.session?.access_token;
      for (const id of selectedScripts) {
        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/run/${id}`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
      alert(`${selectedScripts.length} scripts queued for run!`);
      setSelectedScripts([]);
    }
  };

  const handleCreateScript = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (session) {
      const token = session.session?.access_token;
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/scripts`,
        {
          name: newScriptName,
          code: newScriptCode,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setIsCreateModalOpen(false);
      fetchScripts();
    }
  };

  const handleEditScript = (script: any) => {
    setEditingScript(script);
    setNewScriptName(script.name);
    setNewScriptCode(script.code);
    setIsCreateModalOpen(true);
  };

  const handleUpdateScript = async () => {
    if (editingScript) {
      const { data: session } = await supabase.auth.getSession();
      if (session) {
        const token = session.session?.access_token;
        await axios.put(
          `${import.meta.env.VITE_BACKEND_URL}/scripts/${editingScript.id}`,
          {
            name: newScriptName,
            code: newScriptCode,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setIsCreateModalOpen(false);
        setEditingScript(null);
        fetchScripts();
      }
    }
  };

  const handleDeleteScript = async (id: string) => {
    if (confirm("Are you sure?")) {
      const { data: session } = await supabase.auth.getSession();
      if (session) {
        const token = session.session?.access_token;
        await axios.delete(
          `${import.meta.env.VITE_BACKEND_URL}/scripts/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        fetchScripts();
      }
    }
  };

  const filteredScripts = scripts.filter((script: any) =>
    script.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scripts</CardTitle>
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button
            onClick={() => {
              setEditingScript(null);
              setNewScriptName("");
              setNewScriptCode("// Your script");
              setIsCreateModalOpen(true);
            }}
          >
            Create New
          </Button>
          <Button
            disabled={selectedScripts.length === 0}
            onClick={handleRunSelected}
          >
            Run Selected
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead> {/* Checkbox column */}
              <TableHead>Name</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredScripts.map((script: any) => (
              <TableRow key={script.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedScripts.includes(script.id)}
                    onCheckedChange={(checked) =>
                      handleSelect(script.id, checked as boolean)
                    }
                  />
                </TableCell>
                <TableCell>{script.name}</TableCell>
                <TableCell>{script.created_at}</TableCell>{" "}
                {/* Adjust to your DB field */}
                <TableCell className="space-x-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleEditScript(script)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDeleteScript(script.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingScript ? "Edit Script" : "Create New Script"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Name</Label>
            <Input
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
            />

            <Label>Script Code</Label>
            {/* <Editor
              height="400px"
              defaultLanguage="javascript"
              value={newScriptCode}
              onChange={(value) => setNewScriptCode(value || "")}
              options={{ minimap: { enabled: false } }}
            /> */}

            {/* Visual Recorder Placeholder */}
            <div className="border p-4">
              <p>
                Visual Recorder (Iframe or noVNC integration here for site
                preview and element selection)
              </p>
            </div>

            <Button
              onClick={editingScript ? handleUpdateScript : handleCreateScript}
            >
              {editingScript ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
