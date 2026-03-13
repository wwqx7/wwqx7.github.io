import React, { useEffect, useRef, useState } from 'react';
import { GameLoop } from '../logic/GameLoop';
import { TankLogic } from '../logic/Tank';
import { CameraMode, ModuleState, ShellType } from '../logic/Types';

export default function GameUI() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const [tankState, setTankState] = useState<any>(null);
  const [hits, setHits] = useState<any[]>([]);
  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const gameLoop = new GameLoop(canvasRef.current);
    gameLoopRef.current = gameLoop;

    gameLoop.onStateUpdate = (logic, gunAimData) => {
      setTankState({
        currentSpeed: logic.currentSpeed,
        isReloading: logic.isReloading,
        currentReloadTime: logic.currentReloadTime,
        maxReloadTime: logic.maxReloadTime,
        baseReloadTime: logic.baseReloadTime,
        currentDispersion: logic.currentDispersion,
        currentShell: logic.currentShell,
        adrenalineActive: logic.adrenalineActive,
        adrenalineTimer: logic.adrenalineTimer,
        modules: {
          engine: logic.modules.engine.state,
          tracks: logic.modules.tracks.state,
          gun: logic.modules.gun.state,
          ammoRack: logic.modules.ammoRack.state,
        },
        gunAimData
      });
      setIsDebug(gameLoop.sceneManager.isDebugMode);
      
      // Update hit positions to stick to 3D points
      setHits(prev => prev.map(h => {
        const vector = h.point3d.clone();
        vector.project(gameLoop.sceneManager.camera);
        // Check if behind camera
        if (vector.z > 1) return { ...h, visible: false };
        
        return {
          ...h,
          x: (vector.x * .5 + .5) * window.innerWidth,
          y: (vector.y * -.5 + .5) * window.innerHeight,
          visible: true
        };
      }));
    };

    gameLoop.onHit = (data) => {
      const id = Date.now() + Math.random();
      
      const vector = data.point.clone();
      vector.project(gameLoop.sceneManager.camera);
      
      const x = (vector.x * .5 + .5) * window.innerWidth;
      const y = (vector.y * -.5 + .5) * window.innerHeight;

      setHits(prev => [...prev, { id, x, y, point3d: data.point, visible: vector.z <= 1, ...data }]);
      setTimeout(() => {
        setHits(prev => prev.filter(h => h.id !== id));
      }, 3000);
    };

    gameLoop.start();

    return () => {};
  }, []);

  const handleShellChange = (type: ShellType) => {
    if (gameLoopRef.current) gameLoopRef.current.logic.setShellType(type);
  };

  const handleRepair = () => {
    if (gameLoopRef.current) gameLoopRef.current.logic.useRepairKit();
  };

  const handleAdrenaline = () => {
    if (gameLoopRef.current) gameLoopRef.current.logic.useAdrenaline();
  };

  const getModuleColor = (state: ModuleState) => {
    if (state === ModuleState.NORMAL) return 'text-green-500';
    if (state === ModuleState.DAMAGED) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPenetrationColor = (aimData: any, shell: any) => {
    if (!aimData || !aimData.targetHit) return 'bg-green-500';
    if (shell.penetration > aimData.effectiveArmor * 1.2) return 'bg-green-500';
    if (shell.penetration > aimData.effectiveArmor * 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      
      {/* Fixed Center Crosshair (Camera Aim) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className="w-1 h-1 bg-white rounded-full opacity-80" />
        <div className="absolute w-4 h-[1px] bg-white/50 -left-6" />
        <div className="absolute w-4 h-[1px] bg-white/50 -right-6" />
        <div className="absolute w-[1px] h-4 bg-white/50 -top-6" />
        <div className="absolute w-[1px] h-4 bg-white/50 -bottom-6" />
      </div>

      {/* 2D Dispersion Overlay (Gun Aim) */}
      {tankState?.gunAimData?.inFront && (
        <div 
          className="absolute pointer-events-none flex items-center justify-center transition-all duration-75"
          style={{ 
            left: tankState.gunAimData.x, 
            top: tankState.gunAimData.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Penetration Indicator (Center Dot) */}
          <div className={`w-1 h-1 rounded-full absolute ${getPenetrationColor(tankState.gunAimData, tankState.currentShell)}`} />
          
          {/* Dispersion Circle */}
          <div 
            className="absolute border-2 border-green-500/50 rounded-full transition-all duration-75"
            style={{ 
              width: `${tankState.gunAimData.radius * 2}px`, 
              height: `${tankState.gunAimData.radius * 2}px` 
            }}
          />
          
          {/* Reload Timer next to crosshair */}
          {tankState.isReloading && (
            <div className="absolute left-full ml-2 text-green-500 font-mono text-sm font-bold">
              {tankState.currentReloadTime.toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {/* Hits (Damage & Armor) */}
      <div className="absolute inset-0 pointer-events-none">
        {hits.map((h) => h.visible && (
          <div 
            key={h.id} 
            className="absolute flex flex-col items-center animate-bounce"
            style={{ left: h.x, top: h.y, transform: 'translate(-50%, -100%)' }}
          >
            <span className="text-red-500 font-bold text-2xl drop-shadow-md">-{h.damage}</span>
            {isDebug && (
              <span className="text-yellow-400 text-xs font-mono bg-black/50 px-1 rounded">
                Armor: {h.effectiveArmor}mm
              </span>
            )}
          </div>
        ))}
      </div>

      {/* UI Overlay */}
      {tankState && (
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            <div className="bg-black/50 p-2 rounded text-white font-mono flex gap-4">
              <div>
                <p>Speed: {Math.abs(Math.round(tankState.currentSpeed * 3.6))} km/h</p>
                {isDebug && <p className="text-yellow-400">DEBUG MODE ON</p>}
              </div>
              
              {/* Module Status */}
              <div className="flex flex-col text-sm border-l border-gray-600 pl-4">
                <p className="font-bold mb-1">Modules:</p>
                <p className={getModuleColor(tankState.modules.engine)}>Engine</p>
                <p className={getModuleColor(tankState.modules.tracks)}>Tracks</p>
                <p className={getModuleColor(tankState.modules.gun)}>Gun</p>
                <p className={getModuleColor(tankState.modules.ammoRack)}>Ammo Rack</p>
              </div>
            </div>
            
            <div className="bg-black/50 p-2 rounded text-white text-sm">
              <p>Controls:</p>
              <p>W/A/S/D - Move</p>
              <p>Mouse - Aim | LClick - Fire</p>
              <p>Shift - Sniper Mode</p>
              <p>0 - Toggle Debug Mode</p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex justify-between items-end">
            
            {/* Abilities */}
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={handleRepair}
                className="w-12 h-12 bg-gray-800 border border-gray-600 rounded flex items-center justify-center text-white hover:bg-gray-700 active:bg-gray-600"
                title="Repair Kit"
              >
                🔧
              </button>
              <button 
                onClick={handleAdrenaline}
                className={`w-12 h-12 border rounded flex items-center justify-center text-white transition-colors ${tankState.adrenalineActive ? 'bg-red-600 border-red-400' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                title="Adrenaline"
              >
                ⚡
                {tankState.adrenalineActive && (
                  <span className="absolute text-xs mt-8">{Math.ceil(tankState.adrenalineTimer)}s</span>
                )}
              </button>
            </div>

            {/* Shells */}
            <div className="flex gap-2 pointer-events-auto">
              {Object.values(ShellType).map((type) => (
                <button
                  key={type}
                  onClick={() => handleShellChange(type)}
                  className={`px-4 py-2 rounded font-bold border ${tankState.currentShell.type === type ? 'bg-orange-600 border-orange-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
