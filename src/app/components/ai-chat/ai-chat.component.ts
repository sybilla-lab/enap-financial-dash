import {
  Component, OnInit, ViewChild, ElementRef,
  AfterViewChecked, PLATFORM_ID, inject, ChangeDetectorRef
} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { firstValueFrom } from "rxjs";
import { DataService } from "../../services/data.service";
import { AiChatService, ChatMessage } from "../../services/ai-chat.service";

@Component({
  selector: "app-ai-chat",
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: "./ai-chat.component.html",
  styleUrl: "./ai-chat.component.scss",
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild("messagesEl") messagesEl!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);

  isOpen = false;
  messages: ChatMessage[] = [];
  inputText = "";
  isTyping = false;
  financialContext = "";
  private shouldScroll = false;

  readonly suggestions = [
    "Quanto foi recebido no total?",
    "Como está a execução por projeto?",
    "Qual o saldo disponível atual?",
    "Quais são as maiores categorias de despesa?",
  ];

  constructor(
    private dataService: DataService,
    private aiChat: AiChatService
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.buildFinancialContext();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private async buildFinancialContext(): Promise<void> {
    try {
      const [ind, rd, projetos, runway, gap, categorias] = await Promise.all([
        firstValueFrom(this.dataService.getIndicadoresOperacionais()),
        firstValueFrom(this.dataService.getRecursoDetalhado()),
        firstValueFrom(this.dataService.getProjetoResumos()),
        firstValueFrom(this.dataService.getRunway()),
        firstValueFrom(this.dataService.getGapCaptacao()),
        firstValueFrom(this.dataService.getCategoriaResumos()),
      ]);

      const fmt = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      const projetosStr = projetos
        .map(p => `  • ${p.projeto}: entradas ${fmt(p.entradas)}, saídas ${fmt(p.saidas)}, execução ${p.execucao.toFixed(1)}%, status: ${p.status || "ativo"}`)
        .join("\n");

      const topCategorias = [...categorias]
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map(c => `  • ${c.categoria}: ${fmt(c.total)}`)
        .join("\n");

      this.financialContext = `
INDICADORES GERAIS:
  • Total Recebido: ${fmt(ind.totalRecebido)}
  • Total Executado: ${fmt(ind.totalExecutado)}
  • Saldo Disponível: ${fmt(ind.saldoDisponivel)}
  • Percentual de Execução: ${ind.percentualExecucao.toFixed(1)}%
  • Número de Pagamentos: ${ind.numPagamentos}
  • Ticket Médio por Pagamento: ${fmt(ind.ticketMedio)}

RECURSOS:
  • Aporte ENAP recebido: ${fmt(rd.aporteRecebido)}
  • Captação externa recebida: ${fmt(rd.captacaoRecebida)}
  • Total consolidado recebido: ${fmt(rd.totalRecebido)}
  • Meta de Aporte ENAP: ${fmt(this.dataService.META_APORTE)}
  • Meta de Captação: ${fmt(this.dataService.META_CAPTACAO)}
  • Meta Global: ${fmt(this.dataService.META_TOTAL)}
  • Saldo ainda a captar: ${fmt(rd.saldoACaptar)}

RUNWAY ESTIMADO: ${runway.toFixed(1)} meses
GAP DE CAPTAÇÃO: ${fmt(gap)}

PROJETOS (${projetos.length} projetos):
${projetosStr}

TOP CATEGORIAS DE DESPESA:
${topCategorias}
      `.trim();
    } catch {
      this.financialContext = "Dados financeiros não disponíveis no momento.";
    }
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.shouldScroll = true;
  }

  close(): void {
    this.isOpen = false;
  }

  useSuggestion(text: string): void {
    this.inputText = text;
    this.send();
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    this.inputText = "";
    this.messages.push({ role: "user", content: text });
    this.messages.push({ role: "assistant", content: "" });
    this.isTyping = true;
    this.shouldScroll = true;
    this.cdr.detectChanges();

    const apiMessages: ChatMessage[] = this.messages
      .slice(0, -1)
      .filter(m => m.content.trim())
      .map(m => ({ role: m.role, content: m.content }));

    const assistantIdx = this.messages.length - 1;

    this.aiChat.sendMessage(apiMessages, this.financialContext).subscribe({
      next: (chunk) => {
        this.messages[assistantIdx] = {
          ...this.messages[assistantIdx],
          content: this.messages[assistantIdx].content + chunk,
        };
        this.shouldScroll = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.messages[assistantIdx] = {
          ...this.messages[assistantIdx],
          content: `Erro: ${err.message}`,
        };
        this.isTyping = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isTyping = false;
        this.cdr.detectChanges();
      },
    });
  }

  clearChat(): void {
    this.messages = [];
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
