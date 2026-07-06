import {
  exportPatterns,
  importPatterns,
  loadAndSetFeaturedPatterns,
  loadAndSetPublicPatterns,
  patternFilterName,
  useActivePattern,
  useViewingPatternData,
  userPattern,
  getPatternOrder,
  setPatternOrder,
} from '../../../user_pattern_utils.mjs';
import { useMemo, useRef } from 'react';
import { getMetadata } from '../../../metadata_parser.js';
import { useExamplePatterns } from '../../useExamplePatterns.jsx';
import { parseJSON, isUdels } from '../../util.mjs';
import { useSettings } from '../../../settings.mjs';
import { ActionButton } from '../button/action-button.jsx';
import { Pagination } from '../pagination/Pagination.jsx';
import { useState } from 'react';
import { useDebounce } from '../usedebounce.jsx';
import cx from '@src/cx.mjs';
import { Textbox } from '@src/repl/components/panel/SettingsTab.jsx';

export function PatternLabel({ pattern } /* : { pattern: Tables<'code'> } */) {
  const meta = useMemo(() => getMetadata(pattern.code), [pattern]);

  let title = pattern.customName || meta.title;
  if (title == null) {
    const date = new Date(pattern.created_at);
    if (!isNaN(date)) {
      title = date.toLocaleDateString();
    } else {
      title = pattern.id || 'unnamed';
    }
  }

  const author = pattern.customBy || (Array.isArray(meta.by) ? meta.by.join(',') : 'Anonymous');
  return <>{`${title} by ${author.slice(0, 100)}`.slice(0, 60)}</>;
}

function PatternButton({ showOutline, onClick, pattern, showHiglight, onDragStart, onDragOver, onDrop, isDragging }) {
  return (
    <a
      draggable
      className={cx(
        'mr-4 hover:opacity-50 cursor-move block py-1 px-2 rounded',
        showOutline && 'outline outline-1',
        showHiglight && 'ring-selection',
        isDragging && 'opacity-50 bg-muted',
      )}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <PatternLabel pattern={pattern} />
    </a>
  );
}

function EditDialog({ pattern, onConfirm, onCancel }) {
  const meta = useMemo(() => getMetadata(pattern.code), [pattern]);
  const [newName, setNewName] = useState(pattern.customName || '');
  const [newAuthor, setNewAuthor] = useState(pattern.customBy || (Array.isArray(meta.by) ? meta.by.join(', ') : ''));

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(newName, newAuthor);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-muted rounded p-4 w-80">
        <h2 className="text-foreground mb-4">Edit Pattern</h2>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-foreground mb-2">Title</label>
          <Textbox
            value={newName}
            onChange={setNewName}
            placeholder="Enter pattern title..."
            autoFocus
            className="w-full mb-4"
          />
          <label className="block text-sm text-foreground mb-2">Author</label>
          <Textbox
            value={newAuthor}
            onChange={setNewAuthor}
            placeholder="Enter author name..."
            className="w-full mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-3 py-1 text-sm border rounded hover:bg-muted"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-sm bg-selection text-foreground rounded hover:opacity-80"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ pattern, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-muted rounded p-4 w-80">
        <h2 className="text-foreground mb-4">Delete Pattern?</h2>
        <p className="text-foreground mb-6">
          Are you sure you want to delete <strong><PatternLabel pattern={pattern} /></strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="px-3 py-1 text-sm border rounded hover:bg-muted"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1 text-sm bg-red-600 text-foreground rounded hover:opacity-80"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternButtons({ patterns, activePattern, onClick, started, onReorder }) {
  const viewingPatternData = useViewingPatternData();
  const viewingPatternID = viewingPatternData.id;
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const order = useMemo(() => {
    return getPatternOrder().filter((id) => id in patterns && id !== '_order');
  }, [patterns]);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      const newOrder = [...order];
      const draggedIndex = newOrder.indexOf(draggedId);
      const targetIndex = newOrder.indexOf(targetId);

      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedId);

      onReorder(newOrder);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="p-2">
      {order.map((id) => {
        const pattern = patterns[id];
        if (!pattern) return null;
        return (
          <PatternButton
            pattern={pattern}
            key={id}
            showHiglight={id === viewingPatternID}
            showOutline={id === activePattern && started}
            onClick={() => onClick(id)}
            onDragStart={(e) => handleDragStart(e, id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            isDragging={draggedId === id}
          />
        );
      })}
    </div>
  );
}

const updateCodeWindow = (context, patternData, reset = false) => {
  context.handleUpdate(patternData, reset);
};

export function PatternsTab({ context }) {
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const activePattern = useActivePattern();
  const viewingPatternData = useViewingPatternData();

  const { userPatterns, patternAutoStart } = useSettings();
  const viewingPatternID = viewingPatternData?.id;

  const visiblePatterns = useMemo(() => {
    if (!search) {
      return userPatterns;
    }
    return Object.fromEntries(
      Object.entries(userPatterns).filter(([_key, pattern]) => {
        const meta = getMetadata(pattern.code);

        // Search for specific meta keys
        const searchLowercaseTrimmed = search.trim().toLowerCase();
        if (searchLowercaseTrimmed.includes(':')) {
          const [metaKey, metaSearch] = searchLowercaseTrimmed.split(/:\s*/);
          if (metaKey !== undefined && metaSearch !== undefined && metaKey in meta) {
            const metaValues = meta[metaKey];
            if (Array.isArray(metaValues)) {
              return metaValues.some((metaValue) => metaValue.toLowerCase().includes(metaSearch));
            } else if (typeof metaValues === 'string') {
              return metaValues.toLowerCase().includes(metaSearch);
            } else {
              return false;
            }
          }
        }
        const title = meta.title ? meta.title : 'unnamed';
        const authors = meta.by ? meta.by : ['anonymous'];
        const tags = meta.tag ? meta.tag : [];
        return (
          title.toLowerCase().includes(searchLowercaseTrimmed) ||
          authors.some((author) => author.toLowerCase().includes(searchLowercaseTrimmed)) ||
          tags.some((tag) => tag.toLowerCase().includes(searchLowercaseTrimmed))
        );
      }),
    );
  }, [search, userPatterns]);

  const handleEdit = (newName, newAuthor) => {
    if (newName.trim()) {
      const { data } = userPattern.edit(editTarget.id, newName.trim(), newAuthor.trim());
      if (viewingPatternID === editTarget.id) {
        updateCodeWindow(context, { ...data, collection: userPattern.collection });
      }
    }
    setEditTarget(null);
  };

  const handleConfirmDelete = () => {
    const { data } = userPattern.delete(deleteTarget.id);
    updateCodeWindow(context, { ...data, collection: userPattern.collection });
    setDeleteTarget(null);
  };

  const handleReorder = (newOrder) => {
    setPatternOrder(newOrder);
  };

  const importRef = useRef();
  return (
    <div className="w-full h-full text-foreground flex flex-col overflow-hidden">
      {editTarget && (
        <EditDialog
          pattern={editTarget}
          onConfirm={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          pattern={deleteTarget}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <Textbox className="w-full border-0" placeholder="Search..." value={search} onChange={setSearch} />
      <div className="px-2 shrink-0 h-8 space-x-4 flex max-w-full overflow-x-auto border-y border-muted">
        <ActionButton
          label="new"
          onClick={() => {
            const { data } = userPattern.createAndAddToDB();
            updateCodeWindow(context, data);
          }}
        />
        <ActionButton
          label="duplicate"
          onClick={() => {
            const { data } = userPattern.duplicate(viewingPatternData);
            updateCodeWindow(context, data);
          }}
        />
        <ActionButton
          label="edit"
          onClick={() => {
            if (viewingPatternData?.id) {
              setEditTarget(viewingPatternData);
            }
          }}
        />
        <ActionButton
          label="delete"
          onClick={() => {
            if (viewingPatternData?.id) {
              setDeleteTarget(viewingPatternData);
            }
          }}
        />
        <input
          ref={importRef}
          style={{ display: 'none' }}
          type="file"
          multiple
          accept="text/plain,text/x-markdown,application/json"
          onChange={(e) => importPatterns(e.target.files)}
        />
        <ActionButton label="import" onClick={() => importRef.current.click()} />
        <ActionButton label="export" onClick={exportPatterns} />

        <ActionButton
          label="delete-all"
          onClick={() => {
            const { data } = userPattern.clearAll();
            updateCodeWindow(context, data);
          }}
        />
      </div>

      <div className="overflow-auto">
        {/* bg-background */}
        {/* {patternFilter === patternFilterName.user && ( */}
        <PatternButtons
          onClick={(id) => {
            updateCodeWindow(context, { ...userPatterns[id], collection: userPattern.collection }, patternAutoStart);

            if (context.started && activePattern === id) {
              context.handleEvaluate();
            }
          }}
          patterns={visiblePatterns}
          started={context.started}
          activePattern={activePattern}
          viewingPatternID={viewingPatternID}
          onReorder={handleReorder}
        />
        {/* )} */}
      </div>
    </div>
  );
}

function PatternPageWithPagination({ patterns, patternOnClick, context, paginationOnChange, initialPage }) {
  const [page, setPage] = useState(initialPage);
  const debouncedPageChange = useDebounce(() => {
    paginationOnChange(page);
  });

  const onPageChange = (pageNum) => {
    setPage(pageNum);
    debouncedPageChange();
  };

  const activePattern = useActivePattern();
  return (
    <div className="flex flex-grow flex-col  h-full overflow-hidden justify-between">
      <div className="overflow-auto flex flex-col flex-grow bg-background p-2 rounded-md ">
        <PatternButtons
          onClick={(id) => patternOnClick(id)}
          started={context.started}
          patterns={patterns}
          activePattern={activePattern}
        />
      </div>
      <div className="flex items-center gap-2 py-2">
        <label htmlFor="pattern pagination">Page</label>
        <Pagination id="pattern pagination" currPage={page} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

let featuredPageNum = 1;
function FeaturedPatterns({ context }) {
  const examplePatterns = useExamplePatterns();
  const collections = examplePatterns.collections;
  const patterns = collections.get(patternFilterName.featured);
  const { patternAutoStart } = useSettings();
  return (
    <PatternPageWithPagination
      patterns={patterns}
      context={context}
      initialPage={featuredPageNum}
      patternOnClick={(id) => {
        updateCodeWindow(context, { ...patterns[id], collection: patternFilterName.featured }, patternAutoStart);
      }}
      paginationOnChange={async (pageNum) => {
        await loadAndSetFeaturedPatterns(pageNum - 1);
        featuredPageNum = pageNum;
      }}
    />
  );
}

let latestPageNum = 1;
function LatestPatterns({ context }) {
  const examplePatterns = useExamplePatterns();
  const collections = examplePatterns.collections;
  const patterns = collections.get(patternFilterName.public);
  const { patternAutoStart } = useSettings();
  return (
    <PatternPageWithPagination
      patterns={patterns}
      context={context}
      initialPage={latestPageNum}
      patternOnClick={(id) => {
        updateCodeWindow(context, { ...patterns[id], collection: patternFilterName.public }, patternAutoStart);
      }}
      paginationOnChange={async (pageNum) => {
        await loadAndSetPublicPatterns(pageNum - 1);
        latestPageNum = pageNum;
      }}
    />
  );
}

function PublicPatterns({ context }) {
  const { patternFilter } = useSettings();
  if (patternFilter === patternFilterName.featured) {
    return <FeaturedPatterns context={context} />;
  }
  return <LatestPatterns context={context} />;
}
