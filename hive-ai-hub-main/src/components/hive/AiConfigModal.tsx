import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, CheckCircle2, Cloud, Cpu, Globe, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useHive, type AiProvider } from "@/lib/hive-store";
import { testAiConfig } from "@/lib/api";
import { toast } from "sonner";

const PROVIDER_DEFAULTS: Record<AiProvider, { baseUrl: string; model: string; localOnly: boolean; label: string; icon: React.ElementType }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", localOnly: false, label: "OpenAI-compatible cloud API", icon: Cloud },
  lmstudio: { baseUrl: "http://localhost:1234/v1", model: "local-model", localOnly: true, label: "Local LM Studio", icon: Cpu },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3", localOnly: true, label: "Local Ollama", icon: Server },
  custom: { baseUrl: "", model: "", localOnly: false, label: "Custom endpoint (manual URL)", icon: Globe },
};

export function AiConfigModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { aiConfig, setAiConfig } = useHive();
  const [provider, setProvider] = useState<AiProvider>(aiConfig.provider);
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [model, setModel] = useState(aiConfig.model);
  const [clientSide, setClientSide] = useState(aiConfig.clientSide);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);

  const meta = useMemo(() => PROVIDER_DEFAULTS[provider], [provider]);
  const isLocal = meta.localOnly;

  useEffect(() => {
    if (open) {
      setProvider(aiConfig.provider);
      setBaseUrl(aiConfig.baseUrl);
      setApiKey(aiConfig.apiKey);
      setModel(aiConfig.model);
      setClientSide(aiConfig.clientSide);
    }
  }, [open, aiConfig]);

  const onProviderChange = (p: AiProvider) => {
    setProvider(p);
    const d = PROVIDER_DEFAULTS[p];
    setBaseUrl(d.baseUrl);
    if (!model || PROVIDER_DEFAULTS[provider].model === model) setModel(d.model);
    if (d.localOnly) setClientSide(true);
    else setClientSide(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      if (clientSide) {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: model || "test",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
        toast.success("Connection looks good", { icon: <CheckCircle2 size={16} /> });
      } else {
        const result = await testAiConfig({
          provider_type: provider,
          base_url: baseUrl,
          api_key: apiKey,
          model,
        });
        if (!result.success) throw new Error(result.error || "Test failed");
        toast.success("Connection looks good", { icon: <CheckCircle2 size={16} /> });
      }
    } catch {
      toast.error(
        `Could not reach ${baseUrl}. Make sure your server is running and accepts requests from this origin.`,
      );
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    try {
      await setAiConfig({ provider, baseUrl, apiKey, model, clientSide });
      toast.success("AI configuration saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save AI configuration");
    }
  };

  const showApiKey = !isLocal || !clientSide;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-sm:!fixed max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-b-none max-sm:!rounded-t-2xl max-sm:!max-w-none max-sm:max-h-[92vh] max-sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI configuration</DialogTitle>
          <DialogDescription>
            Choose your provider. HiVe supports cloud and local OpenAI-compatible APIs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => onProviderChange(v as AiProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_DEFAULTS) as AiProvider[]).map((p) => {
                  const Icon = PROVIDER_DEFAULTS[p].icon;
                  return (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <Icon size={14} /> {PROVIDER_DEFAULTS[p].label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model name</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>

          {(isLocal || provider === "custom") && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Checkbox
                id="client-side"
                checked={clientSide}
                disabled={isLocal}
                onCheckedChange={(v) => setClientSide(!!v)}
              />
              <div className="space-y-1">
                <Label htmlFor="client-side" className="text-sm font-medium">
                  Run prompts from browser (client-side)
                </Label>
                <p className="text-xs text-muted-foreground">
                  HiVe will send prompts directly from your browser to this address. Ensure your
                  local LLM server is running and accepts CORS from this origin.
                </p>
              </div>
            </div>
          )}

          {showApiKey && (
            <div className="space-y-2">
              <Label htmlFor="api-key">API key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={show ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your key is stored securely on the server.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} className="bg-brand text-white hover:opacity-90">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
