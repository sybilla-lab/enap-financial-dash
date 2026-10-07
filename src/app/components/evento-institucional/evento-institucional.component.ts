import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OficioRendimentos, ProjetoOficio } from '../../models/lancamento.model';
import { competenciaKey } from '../../services/rateio-rendimentos';

/** Papel do projeto no evento — decide o texto e a cor da faixa. */
export type PapelEvento = 'executor' | 'cedente' | 'preservado';

export interface ItemFaixa {
  rotulo: string;
  valor: number;
  /** Classe de cor: acompanha a paleta --ev-* usada na página de Rendimentos. */
  tom: 'livre' | 'transf' | 'propria' | 'usado' | 'disp';
  ajuda?: string;
}

/**
 * Faixa discreta de evento institucional, para as páginas filtradas por projeto.
 *
 * Mostra o mesmo evento da página de Rendimentos, mas do ponto de vista de um
 * projeto só: quem cedeu vê o que cedeu; quem executa vê o destinado, o
 * utilizado e o saldo a utilizar; quem ficou de fora vê que ficou de fora e com
 * quanto. Aparece apenas quando HÁ um projeto selecionado, quando esse projeto
 * tem o que dizer sobre o evento e quando a competência de efeito cai dentro do
 * período filtrado. Na visão consolidada ela não aparece: ali o evento já é
 * contado pela página de Rendimentos e pelo Histórico de Movimentações.
 *
 * Vocabulário fixo em toda a página: "utilizado" é o que já foi pago,
 * "destinado" é o reservado ainda não pago, "disponível" é tudo o que ainda
 * não foi utilizado e "livre" é a parcela disponível sem destinação. O saldo
 * destinado é subdivisão do disponível — nunca uma carteira à parte a somar.
 */
@Component({
  selector: 'app-evento-institucional',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './evento-institucional.component.html',
  styleUrl: './evento-institucional.component.scss',
})
export class EventoInstitucionalComponent {
  private readonly _oficio = signal<OficioRendimentos | null>(null);
  private readonly _projeto = signal<string | null>(null);
  private readonly _inicio = signal<number | null>(null);
  private readonly _fim = signal<number | null>(null);

  @Input() set oficio(v: OficioRendimentos | null) { this._oficio.set(v ?? null); }
  /** `null` = visão consolidada (todos os projetos). */
  @Input() set projeto(v: string | null) { this._projeto.set(v ?? null); }
  /** Aceita "2026-08" (filtro da visão por projeto) ou Date; vazio = sem limite. */
  @Input() set dataInicio(v: string | Date | null) { this._inicio.set(this.paraCompetencia(v)); }
  @Input() set dataFim(v: string | Date | null) { this._fim.set(this.paraCompetencia(v)); }

  private paraCompetencia(v: string | Date | null | undefined): number | null {
    if (!v) return null;
    if (v instanceof Date) return v.getFullYear() * 100 + (v.getMonth() + 1);
    const m = v.match(/^(\d{4})-(\d{2})$/);
    return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : null;
  }

  readonly dados = computed(() => this.montar());

  /**
   * A faixa só existe quando o evento tem efeito dentro do período filtrado e o
   * projeto selecionado participa da história — senão some, sem deixar card
   * vazio. Um filtro que termina antes de 08/2026 não fala do Ofício.
   */
  private montar() {
    const o = this._oficio();
    if (!o) return null;

    const efeito = competenciaKey(o.competenciaEfeito);
    const inicio = this._inicio();
    const fim = this._fim();
    if (inicio !== null && efeito < inicio) return null;
    if (fim !== null && efeito > fim) return null;

    /**
     * Na visão consolidada a faixa não aparece.
     *
     * Ali ela repetia, com outro recorte, o que a página de Rendimentos já diz
     * e o Histórico de Movimentações agora registra com data e fonte — três
     * lugares para o mesmo R$ 150.002,11. A faixa continua existindo onde só
     * ela responde: dentro de um projeto, dizendo o papel daquele projeto no
     * evento.
     */
    const nome = this._projeto();
    if (!nome) return null;

    const p = o.projetos.find(x => x.projeto === nome);
    if (!p) return null;
    if (p.carteiraSobGestao > 0) return this.executor(o, p);
    if (p.destinado > 0) return this.cedente(o, p);
    if (p.historicoAteDataBase > 0) return this.preservado(o, p);
    return null;
  }

  /** "2026-08" → "08/2026", para o texto corrido não expor formato técnico. */
  private mesAno(competencia: string): string {
    const [ano, mes] = String(competencia).split('-');
    return mes ? `${mes}/${ano}` : competencia;
  }

  private base(o: OficioRendimentos) {
    return {
      documento: o.documento,
      dataBase: o.dataBase,
      competenciaEfeito: o.competenciaEfeito,
      finalidade: o.finalidade,
      executor: o.projetoExecutor,
    };
  }

  private executor(o: OficioRendimentos, p: ProjetoOficio) {
    return {
      ...this.base(o),
      papel: 'executor' as PapelEvento,
      titulo: `Executa a destinação para ${o.finalidade}`,
      texto:
        `Recebeu saldos de rendimentos de outros projetos e destinou rendimento próprio à ${o.finalidade}. ` +
        `O saldo destinado só diminui com pagamento vinculado pelo número — nenhum outro débito o consome.`,
      itens: [
        { rotulo: 'Recebido de outros projetos', valor: p.transferidoRecebido, tom: 'transf' as const,
          ajuda: 'Entrada líquida interprojetos. Não é receita nova do convênio.' },
        { rotulo: 'Rendimento próprio destinado', valor: p.destinacaoPropria, tom: 'propria' as const,
          ajuda: 'Saldo que já era do projeto e mudou de livre para destinado. Não somar ao recebido.' },
        { rotulo: 'Total destinado', valor: p.carteiraSobGestao, tom: 'transf' as const },
        { rotulo: 'Utilizado', valor: p.utilizado, tom: 'usado' as const,
          ajuda: 'Pagamentos já realizados com o saldo destinado.' },
        { rotulo: 'Saldo a utilizar', valor: p.carteiraDisponivel, tom: 'disp' as const,
          ajuda: 'Reservado à finalidade e ainda não pago. Já faz parte do saldo disponível — não se soma de novo.' },
      ] as ItemFaixa[],
    };
  }

  private cedente(o: OficioRendimentos, p: ProjetoOficio) {
    return {
      ...this.base(o),
      papel: 'cedente' as PapelEvento,
      titulo: `Saldo de rendimentos destinado à ${o.finalidade}`,
      texto:
        `O saldo acumulado até ${o.dataBase} foi transferido para a ${o.projetoExecutor}, que executa a ` +
        `${o.finalidade}. O histórico de rendimentos do projeto não foi apagado: o que zerou foi o saldo livre.`,
      itens: [
        { rotulo: `Transferido para a ${o.projetoExecutor}`, valor: p.transferidoCedido, tom: 'transf' as const },
        // Quem destinou tudo tem histórico igual ao transferido: repetir o
        // mesmo número lado a lado não informa nada. Só aparece se diferirem.
        ...(p.saldoLivreAposOficio > 0
          ? [{ rotulo: `Histórico até ${o.dataBase}`, valor: p.historicoAteDataBase, tom: 'propria' as const }]
          : []),
        { rotulo: `Novos rendimentos desde ${this.mesAno(o.competenciaEfeito)}`, valor: p.novosRendimentos, tom: 'livre' as const },
        { rotulo: 'Saldo livre atual', valor: p.saldoLivreAtual, tom: 'livre' as const },
      ] as ItemFaixa[],
    };
  }

  private preservado(o: OficioRendimentos, p: ProjetoOficio) {
    return {
      ...this.base(o),
      papel: 'preservado' as PapelEvento,
      titulo: 'Não participou da realocação de rendimentos',
      texto:
        `O saldo acumulado até ${o.dataBase} foi preservado integralmente no corte de ` +
        `${this.mesAno(o.competenciaEfeito)}, e os rendimentos posteriores seguem acumulando normalmente.`,
      itens: [
        { rotulo: `Saldo preservado em ${o.dataBase}`, valor: p.historicoAteDataBase, tom: 'livre' as const },
        { rotulo: `Novos rendimentos desde ${this.mesAno(o.competenciaEfeito)}`, valor: p.novosRendimentos, tom: 'livre' as const },
        { rotulo: 'Saldo livre atual', valor: p.saldoLivreAtual, tom: 'livre' as const },
      ] as ItemFaixa[],
    };
  }
}
