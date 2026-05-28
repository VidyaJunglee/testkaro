import React from 'react';
import { useStore } from '../store';
import { TestFile } from '../../schema';
import {
  Play, MoreVertical, FileText, CheckCircle2, XCircle, Clock, Plus, Copy, Trash2,
} from 'lucide-react';

/**
 * Module Overview: Shows all tests in the active module/file as a card grid.
 * Displayed when viewLevel === 'module'.
 * Clicking a card drills into that test (sets viewLevel to 'test').
 */
export function ModuleOverview() {
  const store = useStore;
  const file = useStore(s => s.file);
  const projectName = useStore(s => s.projectName);
  const modules = useStore(s => s.modules);
  const activeModuleIndex = useStore(s => s.activeModuleIndex);
  const results = useStore(s => s.results);
  const runHistory = useStore(s => s.runHistory);

  const activeModule = modules[activeModuleIndex] || null;
  const moduleName = activeModule?.name || file.name || 'Tests';
  const tests = file.tests || [];

  const handleOpenTest = (index: number) => {
    store.getState().setActiveTestIndex(index);
    store.getState().setViewLevel('test');
  };

  const handleRunTest = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    store.getState().setActiveTestIndex(index);
    store.getState().setViewLevel('test');
    store.getState().setShowRunner(true);
  };

  const handleAddTest = () => {
    store.getState().addTest();
  };

  const handleDuplicateTest = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const test = tests[index];
    if (!test) return;
    const s = store.getState();
    const newTest = {
      ...test,
      id: crypto.randomUUID(),
      name: `${test.name} (copy)`,
      steps: test.steps.map(step => ({ ...step, id: crypto.randomUUID() })),
    };
    s.setFile({ ...file, tests: [...tests, newTest] });
  };

  const handleDeleteTest = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tests.length <= 1) return;
    store.getState().deleteTest(index);
  };

  // Get last run status for a test by checking stored results
  const getTestStatus = (testIndex: number): 'passed' | 'failed' | 'not_run' => {
    // Check current run results
    const testResults = results.filter(r => r.testIndex === testIndex);
    if (testResults.length > 0) {
      if (testResults.some(r => r.status === 'failed')) return 'failed';
      if (testResults.every(r => r.status === 'passed')) return 'passed';
    }
    return 'not_run';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-text-tertiary mb-2">
            <span>{projectName}</span>
            <span>/</span>
            <span className="text-text-secondary font-medium">{moduleName}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">
                Tests
              </h1>
              <p className="text-sm text-text-tertiary mt-1">
                {tests.length} test{tests.length !== 1 ? 's' : ''} in this module
              </p>
            </div>
            <button
              onClick={handleAddTest}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              <Plus size={14} />
              Add Test
            </button>
          </div>
        </div>

        {/* Test Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {tests.map((test, index) => {
            const status = getTestStatus(index);
            return (
              <div
                key={test.id}
                onClick={() => handleOpenTest(index)}
                className="group relative p-5 rounded-xl border border-border hover:border-accent/40 hover:shadow-md bg-bg-card cursor-pointer transition-all duration-150"
              >
                {/* Status indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  {status === 'passed' && (
                    <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} />
                      Passed
                    </span>
                  )}
                  {status === 'failed' && (
                    <span className="flex items-center gap-1 text-xs text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                      <XCircle size={11} />
                      Failed
                    </span>
                  )}
                  {status === 'not_run' && (
                    <span className="flex items-center gap-1 text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded-full">
                      <Clock size={11} />
                      Not run
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
                    <FileText size={16} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate pr-20">
                      {test.name}
                    </h3>
                    <p className="text-xs text-text-tertiary mt-1">
                      {test.steps.length} step{test.steps.length !== 1 ? 's' : ''}
                    </p>

                    {/* Step preview */}
                    {test.steps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {test.steps.slice(0, 5).map((step, si) => (
                          <span
                            key={si}
                            className="text-[11px] px-1.5 py-0.5 bg-bg-tertiary text-text-secondary rounded"
                          >
                            {step.type}
                          </span>
                        ))}
                        {test.steps.length > 5 && (
                          <span className="text-[11px] px-1.5 py-0.5 text-text-tertiary">
                            +{test.steps.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleRunTest(index, e)}
                    className="p-1.5 rounded-md text-accent hover:bg-accent/10 transition-colors"
                    title="Run test"
                  >
                    <Play size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDuplicateTest(index, e)}
                    className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={13} />
                  </button>
                  {tests.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteTest(index, e)}
                      className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add test card */}
          <div
            onClick={handleAddTest}
            className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border hover:border-accent/40 cursor-pointer transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center group-hover:bg-accent/10 transition-colors">
              <Plus size={18} className="text-text-tertiary group-hover:text-accent transition-colors" />
            </div>
            <span className="text-sm text-text-tertiary group-hover:text-text-secondary mt-2 transition-colors">
              New Test
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
