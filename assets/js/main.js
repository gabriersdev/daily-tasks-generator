const {createApp} = Vue;

const lsKeys = {
  autosave: 'daily-tasks-autosave',
  history: 'daily-tasks-history',
}

const app = createApp({
  data() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = `${tomorrow.getFullYear()}-${('0' + (tomorrow.getMonth() + 1)).slice(-2)}-${('0' + tomorrow.getDate()).slice(-2)}`;
    
    return {
      taskDate: defaultDate,
      newTaskText: '',
      tasks: [],
      history: [],
      historyModal: null,
      sortable: null,
      isRestoring: false,
      lastAutosaveStr: ''
    };
  },
  
  computed: {
    previewContent() {
      let content = `${this.taskDate} TASKS\n\n`;
      this.tasks.forEach(task => {
        content += `[ ] ${this.formatCase(task)}\n`;
      });
      content += ``;
      return content;
    },
  },
  
  watch: {
    tasks: {
      handler() {
        this.autoSave();
      },
      deep: true
    },
    taskDate() {
      this.autoSave();
    }
  },
  
  methods: {
    showToast(message, isRecover = false) {
      const toastContainer = document.getElementById('toast-container');
      const toastTemplate = document.getElementById('toast-template');
      const toastEl = toastTemplate.content.cloneNode(true).firstElementChild;
      const toastBody = toastEl.querySelector('.toast-body');
      const indicator = toastEl.querySelector('.toast-indicator');
      
      if (isRecover) {
        indicator.classList.remove('bg-success');
        indicator.classList.add('bg-info');
      }
      
      toastBody.textContent = message;
      toastContainer.appendChild(toastEl);
      
      const toast = new bootstrap.Toast(toastEl, {delay: 3000});
      toast.show();
      
      toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
      });
    },
    
    focusInputNewTask() {
      if (this.$refs.newTaskInput) {
        setTimeout(() => {
          this.$refs.newTaskInput.focus();
        }, 250);
      }
    },
    
    autoSave() {
      if (this.isRestoring) return;
      
      const data = {
        date: this.taskDate,
        tasks: this.tasks
      };
      
      const currentStr = JSON.stringify(data);
      if (currentStr === this.lastAutosaveStr) return;
      
      this.lastAutosaveStr = currentStr;
      localStorage.setItem(lsKeys.autosave, currentStr);
      this.showToast('Alterações salvas automaticamente.');
    },
    
    loadAutoSave() {
      const saved = localStorage.getItem(lsKeys.autosave);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.tasks && data.tasks.length > 0) {
            this.isRestoring = true;
            this.taskDate = data.date || this.taskDate;
            this.tasks = data.tasks;
            this.lastAutosaveStr = saved;
            
            this.$nextTick(() => {
              this.isRestoring = false;
              this.showToast('Dados recuperados do último salvamento automático.', true);
            });
          }
        } catch (e) {
          console.error('Erro ao recuperar autosave', e);
        }
      }
    },
    
    formatCase(string) {
      if (!string) return '';
      return string.substring(0, 1).toUpperCase() + string.substring(1);
    },
    
    addTask() {
      const taskText = this.newTaskText.trim();
      if (taskText !== '') {
        this.tasks.push(taskText);
        this.newTaskText = '';
      }
      this.focusInputNewTask();
    },
    
    removeTask(index) {
      this.tasks.splice(index, 1);
    },
    
    editTask(index) {
      const taskFind = this.tasks.find((_, i) => i === index);
      if (taskFind) this.newTaskText = taskFind;
      this.removeTask(index);
      this.focusInputNewTask();
    },
    
    removeAllTasksInCurrentEdition() {
      while (this.tasks.length > 0) this.tasks.pop();
    },
    
    generateTxt() {
      if (this.tasks.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Lista Vazia',
          text: 'Adicione pelo menos uma tarefa antes de gerar o arquivo.',
          confirmButtonColor: '#0d6efd'
        });
        return;
      }
      
      const text = this.previewContent;
      const blob = new Blob([text], {type: 'text/plain'});
      const anchor = document.createElement('a');
      anchor.download = `${this.taskDate.replace(/\W/g, "")}.txt`;
      anchor.href = window.URL.createObjectURL(blob);
      anchor.target = '_blank';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      this.saveToHistory();
    },
    
    saveToHistory() {
      const entry = {
        date: this.taskDate,
        tasks: [...this.tasks]
      };
      
      this.history.push(entry);
      localStorage.setItem('tasks-history', JSON.stringify(this.history));
      
      Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: 'Arquivo gerado e salvo no histórico!',
        timer: 1500,
        showConfirmButton: false
      });
    },
    
    loadHistory() {
      this.history = JSON.parse(localStorage.getItem(lsKeys.history)) || [];
    },
    
    clearHistory() {
      Swal.fire({
        title: 'Você tem certeza?',
        text: 'Deseja apagar TODAS as informações salvas? Esta ação não pode ser desfeita.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sim, apagar tudo!',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem('tasksHistory');
          this.loadHistory();
          Swal.fire('Apagado!', 'O histórico foi apagado.', 'success');
        }
      });
    },
    
    reprint(index) {
      const entry = this.history[index];
      let content = `${entry.date} TASKS\n\n`;
      entry.tasks.forEach(task => {
        content += `[ ] ${this.formatCase(task)}\n`;
      });
      content += ``;
      
      const blob = new Blob([content], {type: 'text/plain'});
      const anchor = document.createElement('a');
      anchor.download = `${entry.date.replace(/\W/g, "")}.txt`;
      anchor.href = window.URL.createObjectURL(blob);
      anchor.target = '_blank';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    },
    
    edit(index) {
      const entry = this.history[index];
      this.taskDate = entry.date;
      this.tasks = [...entry.tasks];
      this.historyModal.hide();
    },
    
    deleteItem(index) {
      Swal.fire({
        title: 'Excluir item?',
        text: 'Tem certeza que deseja excluir este item do histórico?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          this.history.splice(index, 1);
          localStorage.setItem(lsKeys.history, JSON.stringify(this.history));
          this.loadHistory();
          Swal.fire('Excluído!', 'O item foi excluído do histórico.', 'success');
        }
      });
    },
    
    formatDate(date) {
      if (!date) return '';
      const [year, month, day] = date.split('-');
      return `${day}/${month}/${year}`;
    }
  },
  
  mounted() {
    this.loadAutoSave();
    this.loadHistory();
    this.historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
    
    const taskList = document.getElementById('task-list');
    this.sortable = new Sortable(taskList, {
      animation: 150,
      onEnd: (evt) => {
        const item = this.tasks.splice(evt.oldIndex, 1)[0];
        this.tasks.splice(evt.newIndex, 0, item);
      }
    });
    
    this.$nextTick(() => {
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-tooltip="true"]'));
      tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    });
  }
});

app.mount('#app');
