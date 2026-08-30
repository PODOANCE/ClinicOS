import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get all tasks
    const { data: tasks, error: listError } = await supabase
      .from('tareas')
      .select('id, titulo, estado')
      .order('created_at', { ascending: false })

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    return NextResponse.json({
      total: tasks?.length || 0,
      tasks: tasks || []
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error verificando tareas' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get all tasks
    const { data: tasks, error: listError } = await supabase
      .from('tareas')
      .select('id')

    if (listError || !tasks || tasks.length === 0) {
      return NextResponse.json({ cleaned: true, deleted: 0 })
    }

    // Delete all tasks
    const taskIds = tasks.map(t => t.id)
    const { error: deleteError } = await supabase
      .from('tareas')
      .delete()
      .in('id', taskIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      cleaned: true,
      deleted: taskIds.length
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error limpiando tareas' }, { status: 500 })
  }
}
