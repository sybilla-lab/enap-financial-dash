import { Injectable, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { Observable } from "rxjs";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

@Injectable({ providedIn: "root" })
export class AiChatService {
  private readonly platformId = inject(PLATFORM_ID);

  sendMessage(messages: ChatMessage[], financialContext: string): Observable<string> {
    return new Observable((observer) => {
      if (!isPlatformBrowser(this.platformId)) {
        observer.complete();
        return;
      }

      fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, financialContext }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
            observer.error(new Error(err.error || `HTTP ${response.status}`));
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") {
                observer.complete();
                return;
              }
              try {
                const parsed = JSON.parse(payload);
                if (parsed.error) { observer.error(new Error(parsed.error)); return; }
                if (parsed.text) observer.next(parsed.text);
              } catch {}
            }
          }
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }
}
