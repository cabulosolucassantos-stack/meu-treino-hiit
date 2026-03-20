import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; 
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { play, pause, refresh, settingsOutline } from 'ionicons/icons';
import { ConfigService } from '../services/config'; 

interface EtapaTreino {
  fase: 'PREPARAÇÃO' | 'AÇÃO' | 'RECUPERAÇÃO' | 'DESCANSO_BLOCO';
  tempo: number;
  rotulo: string;
  exercicio: string;
  bloco: number;
  round: number;
  totalRounds: number;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule], 
})
export class HomePage implements OnInit {
  public tempo: number = 0;
  public timer: any;
  public treinando: boolean = false;
  public treinoIniciado: boolean = false; 
  public telaPiscando: boolean = false;
  public fase: 'PREPARAÇÃO' | 'AÇÃO' | 'RECUPERAÇÃO' | 'DESCANSO_BLOCO' = 'PREPARAÇÃO';
  public tempoInicial: number = 0;
  public wakeLock: any = null;
  public fila: EtapaTreino[] = [];
  
  public rotuloAtual: string = 'Aguardando...'; 
  public indiceBlocoAtual: number = 0; 
  public totalBlocos: number = 0;
  public indiceRoundAtual: number = 0;
  public totalRoundsNoBloco: number = 0;
  
  public progressoTotal: number = 0; 
  public totalEtapasFila: number = 0; 
  public etapaAtualFila: number = 0; 

  private audioCtx: any;

  constructor(
    private router: Router, 
    public configService: ConfigService
  ) {
    addIcons({ 'play': play, 'pause': pause, 'refresh': refresh, 'settings-outline': settingsOutline });
  }

  ngOnInit() {
    this.atualizarConfiguracoesLocais();
  }

  ionViewWillEnter() {
    if (!this.treinando) {
      this.atualizarConfiguracoesLocais();
    }
  }

  // --- LOGICA DE SINCRONIZAÇÃO E CACHE ---

  atualizarConfiguracoesLocais() {
    this.fila = []; 
    this.etapaAtualFila = 0;

    const blocosSalvos = localStorage.getItem('treino_hiit_config');
    const preparacaoSalva = localStorage.getItem('tempo_preparacao');
    const beepSalvo = localStorage.getItem('tempo_beep');

    if (blocosSalvos && blocosSalvos !== 'null') {
      try {
        this.configService.blocos = JSON.parse(blocosSalvos);
        this.configService.tempoPreparacao = Number(preparacaoSalva) || 10;
        this.configService.tempoBeep = Number(beepSalvo) || 3;

        this.tempoInicial = this.configService.tempoPreparacao;
        this.tempo = this.tempoInicial;
        this.fase = 'PREPARAÇÃO';
        this.rotuloAtual = 'Prepare-se!';
        
        this.gerarSequencia(); 
        console.log('Cache verificado e treino regenerado.');
      } catch (e) {
        console.error("Erro no cache, resetando storage...", e);
        localStorage.clear();
      }
    }
  }

  // --- CONTROLE DO TREINO ---

  public iniciarTreinoPelaPrimeiraVez() {
    this.treinoIniciado = true;
    this.iniciarTreino();
  }

  iniciarTreino() {
    if (this.treinando) return; 

    if (this.tempo === this.tempoInicial && this.etapaAtualFila === 0) {
      this.atualizarStatusEtapa();
      if (this.fila[0]) this.falar(this.fila[0].exercicio);
      this.ativarWakeLock();
    }

    this.treinando = true;
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      if (this.tempo > 0) {
        this.tempo--;
        this.verificarSom(this.tempo);
      } else {
        clearInterval(this.timer);
        this.proximaEtapa();
      }
    }, 1000);
  }

  proximaEtapa() {
    if (this.timer) clearInterval(this.timer);
    this.treinando = false;

    this.fila.shift(); 
    this.etapaAtualFila++;

    // O SEGREDO: Delay de 500ms para o Android processar a troca de fase
    setTimeout(() => {
      if (this.fila.length > 0) {
        this.atualizarStatusEtapa();
        
        if (isNaN(this.tempo) || this.tempo <= 0) {
          this.proximaEtapa();
          return;
        }

        const frase = this.fase === 'AÇÃO' ? `Iniciar ${this.rotuloAtual}` : "Respire";
        this.falar(frase);
        
        this.iniciarTreino();
      } else {
        this.finalizarTreino();
      }
    }, 500); 
  }

  // --- UTILITÁRIOS: VOZ E SOM ---

  public falar(texto: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      setTimeout(() => {
        const msg = new SpeechSynthesisUtterance(texto);
        msg.lang = 'pt-BR';
        msg.rate = 1.2; 
        msg.pitch = 1.0;
        msg.volume = 1.0;
        window.speechSynthesis.speak(msg);
      }, 50);
    }
  }

  private verificarSom(tempoSegundos: number) {
    if (tempoSegundos === 5) {
      const proximaAcao = this.fila.find((item, index) => index > 0 && item.fase === 'AÇÃO');
      if (proximaAcao) this.falar(`Próximo: ${proximaAcao.exercicio}`);
    }

    if (tempoSegundos <= 3 && tempoSegundos >= 1) {
      this.tocarBeep(600, 0.1, 'triangle');
      this.piscarTela();
    } else if (tempoSegundos === 0) {
      this.tocarBeep(400, 0.8, 'square');
      this.piscarTela();
    }
  }

  private tocarBeep(freq: number, dur: number, tipo: any) {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    osc.connect(g); g.connect(this.audioCtx.destination);
    g.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + dur);
    osc.start(); osc.stop(this.audioCtx.currentTime + dur);
  }

  // --- ESTRUTURA E AUXILIARES ---

  gerarSequencia() {
    this.fila = [];
    this.totalBlocos = this.configService.blocos.length;

    this.fila.push({ 
      fase: 'PREPARAÇÃO', tempo: Number(this.configService.tempoPreparacao), 
      rotulo: 'Prepare', exercicio: 'Prepare ', bloco: 0, round: 0, totalRounds: 0
    });

    this.configService.blocos.forEach((bloco, bIndex) => {
      bloco.rounds.forEach((round, rIndex) => {
        if (Number(round.esforco) > 0) {
          this.fila.push({ 
            fase: 'AÇÃO', tempo: Number(round.esforco), 
            rotulo: round.exercicio || `Exercício ${rIndex + 1}`,
            exercicio: round.exercicio || 'Exercício',
            bloco: bIndex + 1, round: rIndex + 1, totalRounds: bloco.rounds.length
          });
        }
        if (Number(round.pausa) > 0) {
          this.fila.push({ 
            fase: 'RECUPERAÇÃO', tempo: Number(round.pausa), 
            rotulo: 'Recuperação', exercicio: 'Respire',
            bloco: bIndex + 1, round: rIndex + 1, totalRounds: bloco.rounds.length
          });
        }
      });
      if (bIndex < this.configService.blocos.length - 1 && Number(bloco.descansoPosBloco) > 0) {
        this.fila.push({ 
          fase: 'DESCANSO_BLOCO', tempo: Number(bloco.descansoPosBloco), 
          rotulo: 'Descanso', exercicio: 'Descanso de bloco',
          bloco: bIndex + 1, round: 0, totalRounds: 0
        });
      }
    });
    this.totalEtapasFila = this.fila.length;
  }

  private atualizarStatusEtapa() {
    if (this.fila.length > 0) {
      const atual = this.fila[0];
      this.fase = atual.fase;
      this.tempo = atual.tempo;
      this.rotuloAtual = atual.rotulo;
      this.tempoInicial = this.tempo;
      this.indiceBlocoAtual = atual.bloco;
      this.indiceRoundAtual = atual.round;
      this.totalRoundsNoBloco = atual.totalRounds;
      this.progressoTotal = this.etapaAtualFila / this.totalEtapasFila;
    }
  }

  // --- FINALIZAÇÃO E PAUSE ---

  pausarTreino() {
    this.treinando = false;
    if (this.timer) clearInterval(this.timer);
    this.liberarWakeLock();
  }

  resetarTreino() {
    if (this.timer) clearInterval(this.timer);
    this.treinando = false;
    this.liberarWakeLock();
    this.atualizarConfiguracoesLocais();
  }

  private finalizarTreino() {
    this.pausarTreino();
    this.tempo = 0;
    this.rotuloAtual = 'Treino Concluído!';
    this.falar('Treino concluído. Excelente trabalho!');
    alert('Treino Concluído!');
  }

  async ativarWakeLock() {
    try { if ('wakeLock' in navigator) this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
  }

  liberarWakeLock() {
    if (this.wakeLock) { this.wakeLock.release().then(() => this.wakeLock = null); }
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
}