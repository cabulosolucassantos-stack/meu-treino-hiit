import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { ConfigService } from '../services/config';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons'; 
import { 
  trash, 
  trashBin, 
  copy, 
  add, 
  closeCircle, 
  chevronUp, 
  chevronDown,
  chevronForward
} from 'ionicons/icons'; 

@Component({
  selector: 'app-configuracao',
  templateUrl: './configuracao.page.html',
  styleUrls: ['./configuracao.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ConfiguracaoPage implements OnInit {

  constructor(
    public configService: ConfigService,
    private router: Router,
    private alertController: AlertController
  ) {
    // Registro dos ícones para garantir a renderização no modo Standalone
    addIcons({ 
      'trash': trash, 
      'trash-bin': trashBin, 
      'copy': copy, 
      'add': add, 
      'close-circle': closeCircle, 
      'chevron-up': chevronUp, 
      'chevron-down': chevronDown,
      'chevron-forward': chevronForward
    });
  }

  ngOnInit() {
    this.carregarTreino();
  }

  // --- PERSISTÊNCIA ---
  
  salvarNoDispositivo() {
    // Força a conversão para garantir que o Timer não receba uma String
    const preparacao = Number(this.configService.tempoPreparacao);
    const beep = Number(this.configService.tempoBeep);

    localStorage.setItem('treino_hiit_config', JSON.stringify(this.configService.blocos));
    localStorage.setItem('tempo_preparacao', preparacao.toString());
    localStorage.setItem('tempo_beep', beep.toString());
    
    console.log('Configurações salvas:', { preparacao, beep });
  }

  carregarTreino() {
    try {
      const blocosSalvos = localStorage.getItem('treino_hiit_config');
      const preparacaoSalva = localStorage.getItem('tempo_preparacao');
      const beepSalvo = localStorage.getItem('tempo_beep');

      // Só sobrescreve se realmente houver algo salvo, senão mantém o padrão do ConfigService
      if (blocosSalvos && blocosSalvos !== '[]' && blocosSalvos !== 'null') {
        this.configService.blocos = JSON.parse(blocosSalvos);
      }
      
      if (preparacaoSalva !== null) {
        this.configService.tempoPreparacao = Number(preparacaoSalva);
      }
      
      if (beepSalvo !== null) {
        this.configService.tempoBeep = Number(beepSalvo);
      }

      console.log('Dados carregados com sucesso no dispositivo');
    } catch (error) {
      console.error('Erro ao ler localStorage:', error);
    }
  }

  // --- LÓGICA DE EDIÇÃO ---

  novoBloco() {
    this.configService.blocos.push({
      nome: `Bloco ${this.configService.blocos.length + 1}`,
      expandido: true,
      descansoPosBloco: 60,
      rounds: [{ exercicio: '', esforco: 30, pausa: 10 }]
    });
    this.salvarNoDispositivo();
  }

  addRound(blocoIndex: number, pausaPadrao: number) {
    this.configService.blocos[blocoIndex].rounds.push({
      exercicio: '',
      esforco: 30,
      pausa: pausaPadrao
    });
    this.salvarNoDispositivo();
  }

  duplicarBloco(index: number) {
    const blocoCopiado = JSON.parse(JSON.stringify(this.configService.blocos[index]));
    blocoCopiado.nome = `${blocoCopiado.nome} (Cópia)`;
    this.configService.blocos.push(blocoCopiado);
    this.salvarNoDispositivo();
  }

  removerRound(blocoIndex: number, roundIndex: number) {
    this.configService.blocos[blocoIndex].rounds.splice(roundIndex, 1);
    this.salvarNoDispositivo();
  }

  removerBloco(index: number) {
    this.configService.blocos.splice(index, 1);
    this.salvarNoDispositivo();
  }

  async limparTreinoCompleto() {
    const alert = await this.alertController.create({
      header: 'Limpar Treino?',
      message: 'Isso apagará todos os blocos configurados. Tem certeza?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Limpar Tudo',
          handler: () => {
            this.configService.blocos = [];
            this.salvarNoDispositivo();
          }
        }
      ]
    });
    await alert.present();
  }

  salvar() {
    this.salvarNoDispositivo();
    alert('Preset Salvo!');
    this.router.navigate(['/home']);
  }

  iniciarTreino() {
    this.salvarNoDispositivo();
    this.router.navigate(['/home']);
  }
}