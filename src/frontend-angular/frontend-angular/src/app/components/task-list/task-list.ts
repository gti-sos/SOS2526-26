import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task';
import { Task } from '../../models/task.model';
import { CommonModule } from '@angular/common'; // Importante para usar *ngFor
import { FormsModule } from '@angular/forms'; // Importante para formularios

@Component({
  selector: 'app-task-list',
  standalone: true, // Angular moderno
  imports: [CommonModule, FormsModule],
  templateUrl: './task-list.html',
  styleUrl: './task-list.css'
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];
  newTaskTitle: string = '';

  constructor(private taskService: TaskService) {}

  ngOnInit(): void {
    this.tasks = this.taskService.getTasks();
  }

  addTask() {
    if (this.newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now(),
        title: this.newTaskTitle,
        completed: false
      };
      this.taskService.addTask(newTask);
      this.newTaskTitle = ''; // Limpiar el input
    }
  }

  deleteTask(id: number) {
    this.tasks = this.taskService.deleteTask(id);
  }
}