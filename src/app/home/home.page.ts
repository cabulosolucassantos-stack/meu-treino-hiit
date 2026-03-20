import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; 
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { play, pause, refresh, settingsOutline } from 'ionicons/icons';
import { ConfigService } from '../services/config'; 

// Interface atualizada com suporte a progresso e contadores
interface EtapaTreino {
  fase: 'PREPARAÇÃO' | 'AÇÃO' | 'RECUPERAÇÃO' | 'DESCANSO_BLOCO';
  tempo: number;
  rotulo: string;
  exercicio: string;
  bloco: number; // Índice do bloco atual
  round: number; // Índice do round atual
  totalRounds: number; // Total de rounds no bloco atual
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule], 
})
export class HomePage implements OnInit {
  // --- VARIÁVEIS DE CONTROLE DO TIMER ---
  public tempo: number = 0;
  public timer: any;
  public treinando: boolean = false;
  public telaPiscando: boolean = false;
  public fase: 'PREPARAÇÃO' | 'AÇÃO' | 'RECUPERAÇÃO' | 'DESCANSO_BLOCO' = 'PREPARAÇÃO';
  public tempoInicial: number = 0;
  public wakeLock: any = null;
  public fila: EtapaTreino[] = [];
  
  // --- VARIÁVEIS DE STATUS (PARA A BARRA E CONTADORES) ---
  public rotuloAtual: string = 'Aguardando...'; 
  public indiceBlocoAtual: number = 0; 
  public totalBlocos: number = 0;
  public indiceRoundAtual: number = 0;
  public totalRoundsNoBloco: number = 0;
  
  // Controle de Progresso (0 a 1)
  public progressoTotal: number = 0; 
  public totalEtapasFila: number = 0; 
  public etapaAtualFila: number = 0; 

  constructor(
    private router: Router,
    public configService: ConfigService
  ) {
    addIcons({ play, pause, refresh, 'settings-outline': settingsOutline });
  }

  ngOnInit() {
    this.atualizarValoresDoServico();
  }

  ionViewWillEnter() {
    if (!this.treinando) {
      this.atualizarValoresDoServico();
    }
  }

  private atualizarValoresDoServico() {
    this.fase = 'PREPARAÇÃO';
    this.tempo = Number(this.configService.tempoPreparacao);
    this.rotuloAtual = 'Prepare-se!';
    this.fila = []; 
    this.progressoTotal = 0;
    this.etapaAtualFila = 0;
  }

  // --- LÓGICA DO NARRADOR (VOZ) ---
  public falar(texto: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancela falas anteriores para não encavalar
      const msg = new SpeechSynthesisUtterance(texto);
      msg.lang = 'pt-BR';
      msg.rate = 1.1; 
      window.speechSynthesis.speak(msg);
    }
  }

  private audioCtx: any;

  private tocarBeep(frequencia: number, duracao: number, tipo: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'square') {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    oscillator.type = tipo;
    oscillator.frequency.setValueAtTime(frequencia, this.audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duracao);
    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + duracao);
  }

  private piscarTela() {
    this.telaPiscando = true;
    setTimeout(() => this.telaPiscando = false, 150);
  }

  formatarTempo(segundos: number): string {
    if (segundos < 60) return segundos.toString();
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min}:${seg < 10 ? '0' : ''}${seg}`;
  }

  abrirConfiguracoes() {
    this.router.navigate(['/configuracao']);
  }

  // --- MOTOR DE TREINO COM SUPORTE A CONTADORES ---
  gerarSequencia() {
    this.fila = [];
    this.totalBlocos = this.configService.blocos.length;

    // 1. Adiciona Preparação
    this.fila.push({ 
      fase: 'PREPARAÇÃO', 
      tempo: Number(this.configService.tempoPreparacao), 
      rotulo: 'Prepare',
      exercicio: 'Prepare ',
      bloco: 0,
      round: 0,
      totalRounds: 0
    });

    // 2. Percorre os Blocos
    this.configService.blocos.forEach((bloco, bIndex) => {
      bloco.rounds.forEach((round, rIndex) => {
        
        // Adiciona Ação (Esforço)
        this.fila.push({ 
          fase: 'AÇÃO', 
          tempo: Number(round.esforco), 
          rotulo: round.exercicio || `Exercício ${rIndex + 1}`,
          exercicio: round.exercicio || 'Início do exercício',
          bloco: bIndex,
          round: rIndex,
          totalRounds: bloco.rounds.length
        });

        // Adiciona Pausa
        if (Number(round.pausa) > 0) {
          this.fila.push({ 
            fase: 'RECUPERAÇÃO', 
            tempo: Number(round.pausa), 
            rotulo: 'Recuperação',
            exercicio: 'Respire',
            bloco: bIndex,
            round: rIndex,
            totalRounds: bloco.rounds.length
          });
        }
      });

      // 3. Descanso entre Blocos
      if (bIndex < this.configService.blocos.length - 1) {
        this.fila.push({ 
          fase: 'DESCANSO_BLOCO', 
          tempo: Number(bloco.descansoPosBloco), 
          rotulo: 'Descanso entre Blocos',
          exercicio: 'Descanso de bloco. Recupere-se',
          bloco: bIndex,
          round: 0,
          totalRounds: 0
        });
      }
    });

    this.totalEtapasFila = this.fila.length;
    this.etapaAtualFila = 0;
  }

  async ativarWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Erro no Wake Lock:', err);
    }
  }

  iniciarTreino() {
    if (this.fila.length === 0) this.gerarSequencia();
    
    this.atualizarStatusEtapa();
    const etapaAtiva = this.fila[0];
    
    this.falar(etapaAtiva.exercicio);
    this.ativarWakeLock();
    this.treinando = true;

    if (this.timer) clearInterval(this.timer);
    this.verificarSom(this.tempo);

    this.timer = setInterval(() => {
      if (this.tempo > 0) {
        this.tempo--;
        this.verificarSom(this.tempo);
      } 
      else {
        this.proximaEtapa();
      }
    }, 1000);
  }

  private atualizarStatusEtapa() {
    if (this.fila.length > 0) {
      const atual = this.fila[0];
      this.fase = atual.fase;
      this.tempo = atual.tempo;
      this.rotuloAtual = atual.rotulo;
      this.tempoInicial = this.tempo;
      
      // Atualiza Contadores para o HTML
      this.indiceBlocoAtual = atual.bloco;
      this.indiceRoundAtual = atual.round;
      this.totalRoundsNoBloco = atual.totalRounds;

      // Atualiza Progresso da Barra
      this.progressoTotal = this.etapaAtualFila / this.totalEtapasFila;
    }
  }

  private verificarSom(tempoSegundos: number) {
    if (tempoSegundos === 5) {
      if (this.fase !== 'AÇÃO') {
        const proximaAcao = this.fila.find((item, index) => index > 0 && item.fase === 'AÇÃO');
        if (proximaAcao && proximaAcao.exercicio) {
          this.falar(`Próximo exercício: ${proximaAcao.exercicio}`);
        }
      } 
      else if (this.fase === 'AÇÃO') {
        const proximaEtapa = this.fila.length > 1 ? this.fila[1] : null;
        if (proximaEtapa && proximaEtapa.tempo === 0) {
          const proximoExercicio = this.fila.find((item, index) => index > 1 && item.fase === 'AÇÃO');
          if (proximoExercicio && proximoExercicio.exercicio) {
            this.falar(`Troca direta para ${proximoExercicio.exercicio}`);
          }
        }
      }
    }

    if (tempoSegundos <= 3 && tempoSegundos >= 1) {
      this.tocarBeep(600, 0.1, 'triangle');
      this.piscarTela();
    } 
    else if (tempoSegundos === 0) {
      this.tocarBeep(400, 0.8, 'square');
      this.piscarTela();
    }
  }

  proximaEtapa() {
    this.fila.shift(); 
    this.etapaAtualFila++;

    if (this.fila.length > 0) {
      this.atualizarStatusEtapa();
      const atual = this.fila[0];

      if (this.fase === 'AÇÃO') {
        this.falar("Iniciar!"); 
      } else if (this.tempo > 0) {
        this.falar("Respire!"); 
      }

      if (this.tempo === 0) {
        this.proximaEtapa();
      }
    } else {
      this.progressoTotal = 1; // Garante barra cheia no fim
      this.finalizarTreino();
    }
  }

  pausarTreino() {
    this.treinando = false;
    if (this.timer) clearInterval(this.timer);
    this.liberarWakeLock();
  }

  liberarWakeLock() {
    if (this.wakeLock !== null) {
      this.wakeLock.release().then(() => {
        this.wakeLock = null;
      });
    }
  }

  resetarTreino() {
    if (this.timer) clearInterval(this.timer);
    this.treinando = false;
    this.liberarWakeLock();
    this.atualizarValoresDoServico();
  }

  private finalizarTreino() {
    this.pausarTreino();
    this.tempo = 0;
    this.rotuloAtual = 'Treino Concluído!';
    this.falar('Treino concluído. Excelente trabalho!');
    alert('Treino Concluído! Excelente trabalho, Lucas.');
  }
}