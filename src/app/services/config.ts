import { Injectable } from '@angular/core';

// Moldes para a estrutura do Treino Universal
export interface Round {
  exercicio: string;
  esforco: number;
  pausa: number;
}

export interface Bloco {
  nome: string;
  rounds: Round[];
  descansoPosBloco: number;
  expandido: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  // --- CONFIGURAÇÕES GLOBAIS ---
  public tempoPreparacao: number = 5;
  public tempoBeep: number = 3; // Tempo de bipes ao final de cada fase

  // --- VARIÁVEIS DE COMPATIBILIDADE (Mantidas para não dar erro) ---
  public tempoAcao: number = 15;
  public tempoRecuperacao: number = 15;
  public roundsPorBloco: number = 2;
  public totalBlocos: number = 2;
  public tempoDescansoBloco: number = 10;

  // --- MOTOR UNIVERSAL (A estrutura que a nova tela vai usar) ---
  public blocos: Bloco[] = [
    {
      nome: 'Bloco 1',
      expandido: true,
      descansoPosBloco: 10,
      rounds: [
        { exercicio: 'Agachamento', esforco: 10, pausa: 5 },
        //{ exercicio: 'Flexão', esforco: 10, pausa: 5 }
      ]
    }
  ];

  constructor() { }

  // Aqui no futuro podemos adicionar um método para converter 
  // as variáveis simples para a estrutura de blocos automaticamente.
}