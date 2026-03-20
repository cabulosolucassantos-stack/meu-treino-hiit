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

  constructor(
    private router: Router, 
    public configService: ConfigService
  ) {
    addIcons({ 'play': play, 'pause': pause, 'refresh': refresh, 'settings-outline': settingsOutline });
  }

  ngOnInit() {
    // Inicialização padrão
  }

  // EVENTO CRÍTICO: Roda toda vez que a tela aparece
  ionViewWillEnter() {
    if (!this.treinando) {
      this.atualizarConfiguracoesLocais();
    }
  }

  public atualizarConfiguracoesLocais() {
    const blocosSalvos = localStorage.getItem('treino_hiit_config');
    const preparacaoSalva = localStorage.getItem('tempo_preparacao');
    const beepSalvo = localStorage.getItem('tempo_beep');

    // 1. Sincroniza o Service com o Storage (Garante que os dados novos entrem no app)
    if (blocosSalvos && blocosSalvos !== '[]') {
      this.configService.blocos = JSON.parse(blocosSalvos);
    }
    if (preparacaoSalva) this.configService.tempoPreparacao = Number(preparacaoSalva);
    if (beepSalvo) this.configService.tempoBeep = Number(beepSalvo);

    // 2. Reseta o estado visual para o início
    this.treinoIniciado = false;
    this.fase = 'PREPARAÇÃO';
    this.tempoInicial = Number(this.configService.tempoPreparacao) || 10;
    this.tempo = this.tempoInicial;
    this.rotuloAtual = 'Prepare-se!';
    this.progressoTotal = 0;
    this.etapaAtualFila = 0;

    // 3. REGERA A FILA: Isso é o que faz o treino passar da preparação para o exercício
    this.gerarSequencia();
    
    console.log('Home sincronizada e fila gerada!');
  }

  public iniciarTreinoPelaPrimeiraVez() {
    this.treinoIniciado = true;
    this.iniciarTreino();
  }

  // Lógica do Timer (Play / Resume)
  iniciarTreino() {
    if (this.treinando) return; 

    // Se estiver no exato começo, garante que os dados estão frescos
    if (this.tempo === this.tempoInicial && this.etapaAtualFila === 0) {
      this.atualizarStatusEtapa();
      const etapaAtiva = this.fila[0];
      if (etapaAtiva) this.falar(etapaAtiva.exercicio);
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

  public gerarSequencia() {
    this.fila = [];
    
    // Adiciona Preparação
    this.fila.push({ 
      fase: 'PREPARAÇÃO', 
      tempo: Number(this.configService.tempoPreparacao), 
      rotulo: 'Prepare',
      exercicio: 'Prepare ',
      bloco: 0, round: 0, totalRounds: 0
    });

    // Monta os Blocos e Rounds
    this.configService.blocos.forEach((bloco, bIndex) => {
      bloco.rounds.forEach((round, rIndex) => {
        this.fila.push({ 
          fase: 'AÇÃO', 
          tempo: Number(round.esforco), 
          rotulo: round.exercicio || `Exercício ${rIndex + 1}`,
          exercicio: round.exercicio || 'Início do exercício',
          bloco: bIndex + 1,
          round: rIndex + 1,
          totalRounds: bloco.rounds.length
        });

        if (Number(round.pausa) > 0) {
          this.fila.push({ 
            fase: 'RECUPERAÇÃO', 
            tempo: Number(round.pausa), 
            rotulo: 'Recuperação',
            exercicio: 'Respire',
            bloco: bIndex + 1,
            round: rIndex + 1,
            totalRounds: bloco.rounds.length
          });
        }
      });

      if (bIndex < this.configService.blocos.length - 1) {
        this.fila.push({ 
          fase: 'DESCANSO_BLOCO', 
          tempo: Number(bloco.descansoPosBloco), 
          rotulo: 'Descanso entre Blocos',
          exercicio: 'Descanso de bloco. Recupere-se',
          bloco: bIndex + 1, round: 0, totalRounds: 0
        });
      }
    });

    this.totalEtapasFila = this.fila.length;
    this.totalBlocos = this.configService.blocos.length;
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

  proximaEtapa() {
    this.fila.shift(); 
    this.etapaAtualFila++;

    if (this.fila.length > 0) {
      this.atualizarStatusEtapa();
      
      if (this.fase === 'AÇÃO') this.falar("Iniciar!"); 
      else if (this.tempo > 0) this.falar("Respire!"); 

      // Se a etapa tiver tempo 0, pula para a próxima automaticamente
      if (this.tempo === 0) {
        this.proximaEtapa();
      } else {
        this.treinando = false; // Pequena pausa para o sistema respirar
        this.iniciarTreino(); // Auto-start para a próxima fase
      }
    } else {
      this.progressoTotal = 1;
      this.finalizarTreino();
    }
  }

  // --- MÉTODOS DE APOIO (Beeps, Voz, WakeLock) ---

  public falar(texto: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(texto);
      msg.lang = 'pt-BR';
      window.speechSynthesis.speak(msg);
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
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    osc.connect(g); g.connect(this.audioCtx.destination);
    g.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + dur);
    osc.start(); osc.stop(this.audioCtx.currentTime + dur);
  }
  private audioCtx: any;

  private piscarTela() {
    this.telaPiscando = true;
    setTimeout(() => this.telaPiscando = false, 150);
  }

  async ativarWakeLock() {
    try { if ('wakeLock' in navigator) this.wakeLock = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
  }

  liberarWakeLock() {
    if (this.wakeLock) { this.wakeLock.release().then(() => this.wakeLock = null); }
  }

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