import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { TestFile } from '../../schema';
import {
  Play, MoreVertical, FileText, CheckCircle2, XCircle, Clock, Plus, Copy, Trash2, Tag, X,
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
  const allTests = file.tests || [];

  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [addingTagFor, setAddingTagFor] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState('');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    allTests.forEach(t => t.tags?.forEach(tag => set.add(tag)));
    return Array.from(set).sort();
  }, [allTests]);

  const indexedTests = allTests.map((test, originalIndex) => ({ test, originalIndex }));
  const tests = activeTagFilter
    ? indexedTests.filter(({ test }) => test.tags?.includes(activeTagFilter))
    : indexedTests;

  const addTag = (testIndex: number, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const test = allTests[testIndex];
    const current = test.tags || [];
    if (current.includes(trimmed)) return;
    store.getState().setTestTags(testIndex, [...current, trimmed]);
  };

  const removeTag = (testIndex: number, tag: string) => {
    const test = allTests[testIndex];
    store.getState().setTestTags(testIndex, (test.tags || []).filter(t => t !== tag));
  };

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
    const test = allTests[index];
    if (!test) return;
    const s = store.getState();
    const newTest = {
      ...test,
      id: crypto.randomUUID(),
      name: `${test.name} (copy)`,
      steps: test.steps.map(step => ({ ...step, id: crypto.randomUUID() })),
    };
    s.setFile({ ...file, tests: [...allTests, newTest] });
  };

  const handleDeleteTest = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (allTests.length <= 1) return;
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
                {tests.length} test{tests.length !== 1 ? 's' : ''}
                {activeTagFilter ? ` tagged "${activeTagFilter}"` : ' in this module'}
              </p>
            </div>
            <button
              onClick={handleAddTest}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              <Plus size={14} />
              Add Test
            </button>
          </div>
        </div>

        {/* Tag filter bar */}
        {allTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mb-4">
            <Tag size={12} className="text-text-tertiary shrink-0" />
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  activeTagFilter === tag
                    ? 'bg-accent text-on-accent'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {tag}
              </button>
            ))}
            {activeTagFilter && (
              <button
                onClick={() => setActiveTagFilter(null)}
                className="text-[11px] text-text-tertiary hover:text-text-primary ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Test Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {tests.map(({ test, originalIndex: index }) => {
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

                    {/* Tags */}
                    <div
                      className="mt-2 flex flex-wrap items-center gap-1"
                      onClick={e => e.stopPropagation()}
                    >
                      {test.tags?.map(tag => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded-full font-medium"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(index, tag)}
                            className="hover:text-danger transition-colors"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      {addingTagFor === index ? (
                        <input
                          autoFocus
                          className="w-20 text-[10px] px-1.5 py-0.5 rounded-full bg-bg-input border border-border-subtle outline-none focus:border-border-active"
                          value={tagInput}
                          placeholder="tag name"
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { addTag(index, tagInput); setTagInput(''); setAddingTagFor(null); }
                            if (e.key === 'Escape') { setTagInput(''); setAddingTagFor(null); }
                          }}
                          onBlur={() => { addTag(index, tagInput); setTagInput(''); setAddingTagFor(null); }}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingTagFor(index)}
                          className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Tag size={9} />
                          Add tag
                        </button>
                      )}
                    </div>
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
