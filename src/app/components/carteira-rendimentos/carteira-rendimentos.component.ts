import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OficioRendimentos, ProjetoOficio } from '../../models/lancamento.model';

/**
 * Visão completa do evento institucional, para a página de Rendimentos.
 *
 * É o retrato consolidado: cards de carteira, utilizado e disponível, e a
 * tabela projeto a projeto ligando o acumulado da data-base ao saldo livre de
 * hoje. A versão resumida por projeto é outro componente —
 * `app-evento-institucional`, a faixa discreta da visão por projeto.
 *
 * Nada é calculado aqui: tudo vem apurado do DataService, que lê as
 * movimentações ao vivo da planilha.
 */
@Component({
  selector: 'app-carteira-rendimentos',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './carteira-rendimentos.component.html',
  styleUrl: './carteira-rendimentos.component.scss',
})
export class CarteiraRendimentosComponent {
  @Input() oficio: OficioRendimentos | null = null;

  get oficioPorProjeto(): ProjetoOficio[] {
    return this.oficio ? this.oficio.projetos : [];
  }
}
