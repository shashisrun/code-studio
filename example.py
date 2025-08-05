#!/usr/bin/env python3
"""
Example Python file for Studio Code Editor
Demonstrates syntax highlighting and code structure
"""

import json
import asyncio
from typing import List, Dict, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Task:
    """Represents a task in our task management system."""
    id: int
    title: str
    description: str
    completed: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)


class TaskManager:
    """A simple task management system."""
    
    def __init__(self):
        self.tasks: Dict[int, Task] = {}
        self.next_id = 1
    
    def add_task(self, title: str, description: str, tags: Optional[List[str]] = None) -> Task:
        """Add a new task to the system."""
        task = Task(
            id=self.next_id,
            title=title,
            description=description,
            tags=tags or []
        )
        
        self.tasks[task.id] = task
        self.next_id += 1
        
        print(f"✅ Added task: {task.title}")
        return task
    
    def complete_task(self, task_id: int) -> bool:
        """Mark a task as completed."""
        if task_id in self.tasks:
            self.tasks[task_id].completed = True
            print(f"🎉 Completed task: {self.tasks[task_id].title}")
            return True
        
        print(f"❌ Task {task_id} not found")
        return False
    
    def get_tasks_by_tag(self, tag: str) -> List[Task]:
        """Get all tasks with a specific tag."""
        return [
            task for task in self.tasks.values()
            if tag in task.tags
        ]
    
    def get_pending_tasks(self) -> List[Task]:
        """Get all tasks that are not completed."""
        return [
            task for task in self.tasks.values()
            if not task.completed
        ]
    
    def export_to_json(self, filename: str) -> None:
        """Export tasks to a JSON file."""
        tasks_data = []
        
        for task in self.tasks.values():
            task_dict = {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'completed': task.completed,
                'created_at': task.created_at.isoformat(),
                'tags': task.tags
            }
            tasks_data.append(task_dict)
        
        try:
            with open(filename, 'w', encoding='utf-8') as file:
                json.dump(tasks_data, file, indent=2, ensure_ascii=False)
            print(f"📄 Exported {len(tasks_data)} tasks to {filename}")
        except IOError as e:
            print(f"❌ Error exporting tasks: {e}")
    
    async def async_process_tasks(self) -> None:
        """Demonstrate async processing of tasks."""
        print("🔄 Processing tasks asynchronously...")
        
        for task in self.tasks.values():
            # Simulate some async work
            await asyncio.sleep(0.1)
            
            # Process the task (example: update something)
            print(f"  Processing: {task.title}")
        
        print("✅ Async processing completed")


def demonstrate_features():
    """Demonstrate the task manager features."""
    print("🚀 Starting Task Manager Demo")
    print("=" * 50)
    
    # Create task manager
    manager = TaskManager()
    
    # Add some sample tasks
    manager.add_task(
        "Build code editor",
        "Create a modern code editor with Tauri and React",
        ["development", "tauri", "react"]
    )
    
    manager.add_task(
        "Write documentation",
        "Document the API and usage examples",
        ["documentation", "writing"]
    )
    
    manager.add_task(
        "Add tests",
        "Write unit tests for the core functionality",
        ["testing", "development"]
    )
    
    # Complete a task
    manager.complete_task(1)
    
    # Show pending tasks
    pending = manager.get_pending_tasks()
    print(f"\n📝 Pending tasks: {len(pending)}")
    for task in pending:
        print(f"  - {task.title}")
    
    # Show tasks by tag
    dev_tasks = manager.get_tasks_by_tag("development")
    print(f"\n💻 Development tasks: {len(dev_tasks)}")
    for task in dev_tasks:
        status = "✅" if task.completed else "⏳"
        print(f"  {status} {task.title}")
    
    # Export tasks
    manager.export_to_json("tasks.json")
    
    print("\n" + "=" * 50)
    print("✨ Demo completed!")


async def main():
    """Main async function."""
    demonstrate_features()
    
    # Demonstrate async functionality
    manager = TaskManager()
    manager.add_task("Async task 1", "First async task", ["async"])
    manager.add_task("Async task 2", "Second async task", ["async"])
    
    await manager.async_process_tasks()


if __name__ == "__main__":
    # Run the demo
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Error: {e}")
